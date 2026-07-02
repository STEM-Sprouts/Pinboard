/**
 * Blocks→IR lowering tests (implemenation_plam/codegen.md §6): the lowering
 * is a pure function of the Blockly JSON, and the printed C of the lowered
 * starter workspace must equal the canonical blink golden file — the same
 * IR feeds the simulator, so this pins the whole pipeline together.
 */
import { describe, expect, it } from 'vitest';
import { printArduino } from '../arduino/printArduino';
import { blinkExpectedC } from '../testing/fixtures';
import { lowerWorkspaceToIR, type BlocklyWorkspaceJson } from './lowerBlocklyToIR';
import { starterWorkspaceJson } from './starterProject';

describe('Blocks → IR lowering', () => {
  it('lowers the starter blink workspace to IR that prints the canonical blink C', () => {
    const { program, diagnostics } = lowerWorkspaceToIR(starterWorkspaceJson);
    expect(diagnostics).toEqual([]);
    expect(program.loop.map((s) => s.kind)).toEqual(['digitalWrite', 'delay', 'digitalWrite', 'delay']);
    expect(printArduino(program).code).toBe(blinkExpectedC);
  });

  it('lowers a button workspace: read_pin implies INPUT_PULLUP and serial print is real', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'if_do',
                  inputs: {
                    CONDITION: { block: { type: 'read_pin', fields: { PIN: 2 } } },
                    DO: {
                      block: {
                        type: 'set_pin',
                        fields: { PIN: 13, STATE: 'HIGH' },
                        next: {
                          block: {
                            type: 'serial_print',
                            inputs: { VALUE: { block: { type: 'string_text', fields: { TEXT: 'released' } } } },
                          },
                        },
                      },
                    },
                  },
                  next: { block: { type: 'delay_ms', fields: { DELAY: 20 } } },
                },
              },
            },
          },
        ],
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace);
    expect(diagnostics).toEqual([]);
    expect(program.setup[0]).toEqual({ kind: 'pinMode', pin: 'D2', mode: 'INPUT_PULLUP', explicit: false });

    const { code } = printArduino(program);
    expect(code).toContain('pinMode(2, INPUT_PULLUP);');
    expect(code).toContain('Serial.begin(9600);');
    expect(code).toContain('if (digitalRead(2)) {');
    expect(code).toContain('Serial.println("released");');
    expect(code).toContain('delay(20);');
  });

  it('lowers repeat_times to a repeat statement with its body', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'repeat_times',
                  fields: { TIMES: 3 },
                  inputs: { DO: { block: { type: 'set_pin', fields: { PIN: 12, STATE: 'HIGH' } } } },
                },
              },
            },
          },
        ],
      },
    };
    const { program } = lowerWorkspaceToIR(workspace);
    expect(program.loop).toEqual([
      {
        kind: 'repeat',
        times: { kind: 'num', value: 3 },
        body: [{ kind: 'digitalWrite', pin: 'D12', value: { kind: 'bool', value: true } }],
      },
    ]);
  });

  it('sends orphan top-level blocks to loop() with an info diagnostic', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: { languageVersion: 0, blocks: [{ type: 'set_pin', id: 'orphan', fields: { PIN: 13, STATE: 'HIGH' } }] },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace);
    expect(program.loop).toHaveLength(1);
    expect(diagnostics.some((d) => d.id.startsWith('orphan-top-block'))).toBe(true);
  });

  it('reports unsupported blocks instead of failing', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'arduino_loop', inputs: { DO: { block: { type: 'mystery_block' } } } },
        ],
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace);
    expect(program.loop).toEqual([]);
    expect(diagnostics.some((d) => d.id === 'unsupported-statement-block:mystery_block')).toBe(true);
  });

  it('clamps out-of-range pins with a warning', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'arduino_loop', inputs: { DO: { block: { type: 'set_pin', fields: { PIN: 42, STATE: 'HIGH' } } } } },
        ],
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace);
    expect(program.loop[0]).toMatchObject({ kind: 'digitalWrite', pin: 'D13' });
    expect(diagnostics.some((d) => d.id.startsWith('pin-out-of-range'))).toBe(true);
  });

  it('an empty workspace lowers to an empty program', () => {
    const { program, diagnostics } = lowerWorkspaceToIR({});
    expect(program.setup).toEqual([]);
    expect(program.loop).toEqual([]);
    expect(diagnostics).toEqual([]);
  });
});
