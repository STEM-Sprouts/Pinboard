/**
 * Lesson check tests (implemenation_plam/lessons.md §4): checks read project
 * state, IR, or a headless runtime trace — the starter project must pass
 * Lesson 1 outright, and behavioral checks must fail for programs that only
 * look right structurally.
 */
import { describe, expect, it } from 'vitest';
import { lowerWorkspaceToIR, type BlocklyWorkspaceJson } from '../editor/lowerBlocklyToIR';
import { starterComponents, starterWorkspaceJson } from '../editor/starterProject';
import { createLocalProject } from '../persistence/projectDocument';
import { evaluateAllChecks, evaluateCheck, type CheckContext } from './checks';
import { lessons } from './lessons';

const NOW = '2026-07-02T00:00:00.000Z';

function contextFor(workspace: BlocklyWorkspaceJson, components = starterComponents): CheckContext {
  return {
    document: createLocalProject('t', workspace, NOW, 'Test', components),
    program: lowerWorkspaceToIR(workspace, components).program,
  };
}

const starterCtx = contextFor(starterWorkspaceJson);

describe('lesson checks', () => {
  it('the starter project passes every Blink lesson check', async () => {
    const blink = lessons.find((l) => l.id === 'blink-led')!;
    const results = await evaluateAllChecks(blink.checks, starterCtx);
    expect(results).toEqual({
      'led-exists': true,
      'led-on-d13': true,
      'writes-d13': true,
      'uses-delay': true,
      'really-blinks': true,
    });
  });

  it('componentOnPin fails when the component sits on another pin', async () => {
    expect(
      await evaluateCheck(
        { kind: 'componentOnPin', componentType: 'led', pinRole: 'signal', expectedPin: 'D9' },
        starterCtx,
      ),
    ).toBe(false);
  });

  it('hasInstruction respects the pin filter', async () => {
    expect(
      await evaluateCheck({ kind: 'hasInstruction', statementKind: 'digitalWrite', pin: 'D12' }, starterCtx),
    ).toBe(false);
  });

  it('runtimePinToggles fails for a pin that never changes twice', async () => {
    const constant: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'set_pin',
                  fields: { PIN: 13, STATE: 'HIGH' },
                  next: { block: { type: 'delay_ms', fields: { DELAY: 100 } } },
                },
              },
            },
          },
        ],
      },
    };
    expect(await evaluateCheck({ kind: 'runtimePinToggles', pin: 'D13' }, contextFor(constant))).toBe(false);
  });

  it('serialIncludes runs the program and inspects real output', async () => {
    const printer: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'serial_print',
                  inputs: { VALUE: { block: { type: 'string_text', fields: { TEXT: 'hola mundo' } } } },
                  next: { block: { type: 'delay_ms', fields: { DELAY: 100 } } },
                },
              },
            },
          },
        ],
      },
    };
    const ctx = contextFor(printer);
    expect(await evaluateCheck({ kind: 'serialIncludes', text: 'hola' }, ctx)).toBe(true);
    expect(await evaluateCheck({ kind: 'serialIncludes', text: 'adios' }, ctx)).toBe(false);
  });
});

describe('lesson data', () => {
  it('every lesson has steps and uniquely-identified checks', () => {
    for (const lesson of lessons) {
      expect(lesson.steps.length).toBeGreaterThan(0);
      const ids = lesson.checks.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('runtimePinWritesPwm', () => {
  it('passes when the program really writes PWM to the pin, fails otherwise', async () => {
    const pwmWorkspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'set_pwm',
                  fields: { PIN: 9 },
                  inputs: { VALUE: { block: { type: 'num_value', fields: { NUM: 128 } } } },
                },
              },
            },
          },
        ],
      },
    };
    const ctx = contextFor(pwmWorkspace);
    expect(await evaluateCheck({ kind: 'runtimePinWritesPwm', pin: 'D9' }, ctx)).toBe(true);
    expect(await evaluateCheck({ kind: 'runtimePinWritesPwm', pin: 'D3' }, ctx)).toBe(false);
  });
});

describe('Phase-3 check kinds', () => {
  const servoWorkspace: BlocklyWorkspaceJson = {
    variables: [{ id: 'v-a', name: 'angle' }],
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'arduino_loop',
          inputs: {
            DO: {
              block: {
                type: 'for_range',
                fields: { VAR: { id: 'v-a' }, FROM: 0, TO: 180, BY: 45 },
                inputs: {
                  DO: {
                    block: {
                      type: 'servo_set_angle',
                      fields: { COMPONENT: 'sv1' },
                      inputs: { ANGLE: { block: { type: 'var_get', fields: { VAR: { id: 'v-a' } } } } },
                      next: { block: { type: 'delay_ms', fields: { DELAY: 100 } } },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    },
  };
  const servo = {
    id: 'sv1',
    type: 'servo' as const,
    displayName: 'Servo 1',
    position: { x: 0, y: 0 },
    config: {},
    pins: { signal: 'D9' as const },
  };

  it('lacksInstruction passes only when the statement kind is absent', async () => {
    const ctx = contextFor(servoWorkspace, [servo]);
    expect(await evaluateCheck({ kind: 'lacksInstruction', statementKind: 'digitalWrite' }, ctx)).toBe(true);
    expect(await evaluateCheck({ kind: 'lacksInstruction', statementKind: 'delay' }, ctx)).toBe(false);
  });

  it('runtimeServoMoves proves the arm really sweeps through angles', async () => {
    const ctx = contextFor(servoWorkspace, [servo]);
    expect(await evaluateCheck({ kind: 'runtimeServoMoves', pin: 'D9' }, ctx)).toBe(true);
    expect(await evaluateCheck({ kind: 'runtimeServoMoves', pin: 'D6' }, ctx)).toBe(false);
  });

  it('runtimeTonePlays proves a tone really sounds', async () => {
    const buzzer = {
      id: 'bz1',
      type: 'buzzer' as const,
      displayName: 'Buzzer 1',
      position: { x: 0, y: 0 },
      config: {},
      pins: { signal: 'D8' as const },
    };
    const toneWorkspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'buzzer_play',
                  fields: { COMPONENT: 'bz1', FREQ: 880 },
                  next: { block: { type: 'delay_ms', fields: { DELAY: 200 } } },
                },
              },
            },
          },
        ],
      },
    };
    const ctx = contextFor(toneWorkspace, [buzzer]);
    expect(await evaluateCheck({ kind: 'runtimeTonePlays', pin: 'D8' }, ctx)).toBe(true);
    expect(await evaluateCheck({ kind: 'runtimeTonePlays', pin: 'D4' }, ctx)).toBe(false);
  });
});
