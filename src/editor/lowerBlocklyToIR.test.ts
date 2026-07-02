/**
 * Blocks→IR lowering tests (implemenation_plam/codegen.md §6): the lowering
 * is a pure function of the Blockly JSON, and the printed C of the lowered
 * starter workspace must equal the canonical blink golden file — the same
 * IR feeds the simulator, so this pins the whole pipeline together.
 */
import { describe, expect, it } from 'vitest';
import { printArduino } from '../arduino/printArduino';
import type { PinId } from '../hardware/types';
import type { ComponentInstance } from '../persistence/projectDocument';
import { blinkExpectedC } from '../testing/fixtures';
import { runHeadless } from '../testing/synthetic';
import { lowerWorkspaceToIR, type BlocklyWorkspaceJson } from './lowerBlocklyToIR';
import { starterWorkspaceJson } from './starterProject';

const makeLed = (id: string, pin: PinId | null, activeHigh = true): ComponentInstance => ({
  id,
  type: 'led',
  displayName: id,
  position: { x: 0, y: 0 },
  config: { color: 'red', activeHigh },
  pins: { signal: pin },
});

const makeButton = (id: string, pin: PinId | null, pullMode = 'internal_pullup'): ComponentInstance => ({
  id,
  type: 'button',
  displayName: id,
  position: { x: 0, y: 0 },
  config: { pullMode },
  pins: { signal: pin },
});

const makePot = (id: string, pin: PinId | null): ComponentInstance => ({
  id,
  type: 'potentiometer',
  displayName: id,
  position: { x: 0, y: 0 },
  config: {},
  pins: { signal: pin },
});

const ledWorkspace = (componentId: string, state: 'ON' | 'OFF'): BlocklyWorkspaceJson => ({
  blocks: {
    languageVersion: 0,
    blocks: [
      {
        type: 'arduino_loop',
        inputs: { DO: { block: { type: 'led_set', fields: { COMPONENT: componentId, STATE: state } } } },
      },
    ],
  },
});

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

describe('component blocks (config-driven, never hardcoded polarity)', () => {
  it('active-high and active-low LEDs emit opposite electrical writes for "on"', () => {
    const activeHigh = lowerWorkspaceToIR(ledWorkspace('led-a', 'ON'), [makeLed('led-a', 'D13', true)]);
    const activeLow = lowerWorkspaceToIR(ledWorkspace('led-b', 'ON'), [makeLed('led-b', 'D13', false)]);
    expect(activeHigh.program.loop[0]).toEqual({
      kind: 'digitalWrite',
      pin: 'D13',
      value: { kind: 'bool', value: true },
    });
    expect(activeLow.program.loop[0]).toEqual({
      kind: 'digitalWrite',
      pin: 'D13',
      value: { kind: 'bool', value: false },
    });
  });

  it('"off" inverts per wiring too', () => {
    const activeLowOff = lowerWorkspaceToIR(ledWorkspace('led-b', 'OFF'), [makeLed('led-b', 'D9', false)]);
    expect(activeLowOff.program.loop[0]).toEqual({
      kind: 'digitalWrite',
      pin: 'D9',
      value: { kind: 'bool', value: true },
    });
  });

  it('button pull mode decides the pressed comparison and the pinMode', () => {
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
                  inputs: { CONDITION: { block: { type: 'button_is_pressed', fields: { COMPONENT: 'btn' } } } },
                },
              },
            },
          },
        ],
      },
    };

    const pullup = lowerWorkspaceToIR(workspace, [makeButton('btn', 'D2', 'internal_pullup')]);
    expect(pullup.program.setup[0]).toEqual({ kind: 'pinMode', pin: 'D2', mode: 'INPUT_PULLUP', explicit: false });
    expect(pullup.program.loop[0]).toMatchObject({
      kind: 'if',
      condition: { kind: 'binary', op: '==', right: { kind: 'bool', value: false } },
    });

    const pulldown = lowerWorkspaceToIR(workspace, [makeButton('btn', 'D2', 'external_pulldown')]);
    expect(pulldown.program.setup[0]).toEqual({ kind: 'pinMode', pin: 'D2', mode: 'INPUT', explicit: false });
    expect(pulldown.program.loop[0]).toMatchObject({
      kind: 'if',
      condition: { kind: 'binary', op: '==', right: { kind: 'bool', value: true } },
    });
  });

  it('pot_read lowers to analogRead of the instance pin', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'serial_print',
                  inputs: { VALUE: { block: { type: 'pot_read', fields: { COMPONENT: 'pot' } } } },
                },
              },
            },
          },
        ],
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace, [makePot('pot', 'A0')]);
    expect(diagnostics).toEqual([]);
    expect(program.loop[0]).toEqual({
      kind: 'serialPrint',
      value: { kind: 'read', op: 'analog', pin: 'A0' },
      newline: true,
    });
  });

  it('a component block without a placed component is an error, not a crash', () => {
    const { program, diagnostics } = lowerWorkspaceToIR(ledWorkspace('__none__', 'ON'), []);
    expect(program.loop).toEqual([]);
    expect(diagnostics.some((d) => d.id.startsWith('missing-component') && d.severity === 'error')).toBe(true);
  });

  it('a component without a pin is an error and the block is skipped', () => {
    const { program, diagnostics } = lowerWorkspaceToIR(ledWorkspace('led-a', 'ON'), [makeLed('led-a', null)]);
    expect(program.loop).toEqual([]);
    expect(diagnostics.some((d) => d.id === 'component-unpinned:led-a' && d.severity === 'error')).toBe(true);
  });
});

describe('variables, logic, math, time blocks', () => {
  const counterWorkspace: BlocklyWorkspaceJson = {
    variables: [{ id: 'v1', name: 'count' }],
    blocks: {
      languageVersion: 0,
      blocks: [
        {
          type: 'arduino_loop',
          inputs: {
            DO: {
              block: {
                type: 'var_change',
                fields: { VAR: { id: 'v1' } },
                inputs: { DELTA: { block: { type: 'num_value', fields: { NUM: 1 } } } },
                next: {
                  block: {
                    type: 'serial_print',
                    inputs: { VALUE: { block: { type: 'var_get', fields: { VAR: { id: 'v1' } } } } },
                    next: { block: { type: 'delay_ms', fields: { DELAY: 100 } } },
                  },
                },
              },
            },
          },
        },
      ],
    },
  };

  it('variables become zero-initialized globals and persist across loop passes', async () => {
    const { program, diagnostics } = lowerWorkspaceToIR(counterWorkspace);
    expect(diagnostics).toEqual([]);
    expect(program.globals).toEqual([
      { name: 'count', valueType: 'number', initial: { kind: 'num', value: 0 } },
    ]);

    const { code } = printArduino(program);
    expect(code).toContain('long count = 0;');
    expect(code).toContain('count += 1;');
    expect(code).toContain('Serial.println(count);');

    // Behavioral proof on the same IR: the counter really counts.
    const run = await runHeadless(program, { maxFrames: 100 });
    expect(run.serialLines.slice(0, 3)).toEqual(['1', '2', '3']);
  });

  it('if/else with a comparison prints readable C', () => {
    const workspace: BlocklyWorkspaceJson = {
      variables: [{ id: 'v1', name: 'count' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'if_else',
                  inputs: {
                    CONDITION: {
                      block: {
                        type: 'compare_op',
                        fields: { OP: 'GTE' },
                        inputs: {
                          A: { block: { type: 'var_get', fields: { VAR: { id: 'v1' } } } },
                          B: { block: { type: 'num_value', fields: { NUM: 3 } } },
                        },
                      },
                    },
                    DO: { block: { type: 'set_pin', fields: { PIN: 13, STATE: 'HIGH' } } },
                    ELSE: { block: { type: 'set_pin', fields: { PIN: 13, STATE: 'LOW' } } },
                  },
                },
              },
            },
          },
        ],
      },
    };
    const { code } = printArduino(lowerWorkspaceToIR(workspace).program);
    expect(code).toContain('if (count >= 3) {');
    expect(code).toContain('} else {');
  });

  it('wait_until folds the negation into the comparison', () => {
    const workspace: BlocklyWorkspaceJson = {
      variables: [{ id: 'v1', name: 'count' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'wait_until',
                  inputs: {
                    CONDITION: {
                      block: {
                        type: 'compare_op',
                        fields: { OP: 'EQ' },
                        inputs: {
                          A: { block: { type: 'var_get', fields: { VAR: { id: 'v1' } } } },
                          B: { block: { type: 'num_value', fields: { NUM: 5 } } },
                        },
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
    const { code } = printArduino(lowerWorkspaceToIR(workspace).program);
    expect(code).toContain('while (count != 5) { }');
  });

  it('wait_until on a bare read prints a !read spin', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'wait_until',
                  inputs: { CONDITION: { block: { type: 'read_pin', fields: { PIN: 2 } } } },
                },
              },
            },
          },
        ],
      },
    };
    const { code } = printArduino(lowerWorkspaceToIR(workspace).program);
    expect(code).toContain('while (!digitalRead(2)) { }');
  });

  it('random is inclusive for students, exclusive in the C (Arduino semantics)', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'serial_print',
                  inputs: { VALUE: { block: { type: 'random_range', fields: { FROM: 1, TO: 10 } } } },
                },
              },
            },
          },
        ],
      },
    };
    const { code } = printArduino(lowerWorkspaceToIR(workspace).program);
    expect(code).toContain('random(1, 11)');
  });

  it('map_range lowers to the Arduino map() call', () => {
    const workspace: BlocklyWorkspaceJson = {
      variables: [{ id: 'v1', name: 'knob' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'serial_print',
                  inputs: {
                    VALUE: {
                      block: {
                        type: 'map_range',
                        fields: { FROMLOW: 0, FROMHIGH: 1023, TOLOW: 0, TOHIGH: 255 },
                        inputs: { VALUE: { block: { type: 'var_get', fields: { VAR: { id: 'v1' } } } } },
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
    const { code } = printArduino(lowerWorkspaceToIR(workspace).program);
    expect(code).toContain('map(knob, 0, 1023, 0, 255)');
  });

  it('a variable block with a dangling id is an error, not a crash', () => {
    const workspace: BlocklyWorkspaceJson = {
      variables: [],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'var_set',
                  fields: { VAR: { id: 'ghost' } },
                  inputs: { VALUE: { block: { type: 'num_value', fields: { NUM: 1 } } } },
                },
              },
            },
          },
        ],
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace);
    expect(program.loop).toEqual([]);
    expect(diagnostics.some((d) => d.id.startsWith('unknown-variable') && d.severity === 'error')).toBe(true);
  });
});

describe('source block ids (codegen.md §9 CodeSourceMap)', () => {
  it('every lowered statement carries the id of the block that produced it', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            id: 'loop-block',
            inputs: {
              DO: {
                block: {
                  type: 'set_pin',
                  id: 'write-block',
                  fields: { PIN: 13, STATE: 'HIGH' },
                  next: { block: { type: 'delay_ms', id: 'delay-block', fields: { DELAY: 500 } } },
                },
              },
            },
          },
        ],
      },
    };
    const { program } = lowerWorkspaceToIR(workspace);
    expect(program.loop.map((stmt) => stmt.sourceBlockId)).toEqual(['write-block', 'delay-block']);
  });

  it('nested statements carry their own block ids, containers keep theirs', () => {
    const workspace: BlocklyWorkspaceJson = {
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            id: 'loop-block',
            inputs: {
              DO: {
                block: {
                  type: 'if_do',
                  id: 'if-block',
                  inputs: {
                    CONDITION: { block: { type: 'read_pin', id: 'read-block', fields: { PIN: 2 } } },
                    DO: { block: { type: 'set_pin', id: 'inner-block', fields: { PIN: 13, STATE: 'HIGH' } } },
                  },
                },
              },
            },
          },
        ],
      },
    };
    const { program } = lowerWorkspaceToIR(workspace);
    const [ifStmt] = program.loop;
    expect(ifStmt.sourceBlockId).toBe('if-block');
    if (ifStmt.kind !== 'if') throw new Error('expected if');
    expect(ifStmt.then[0].sourceBlockId).toBe('inner-block');
  });
});

describe('PWM, for-range, constrain/min/max/abs, comment blocks', () => {
  const inLoop = (block: object): BlocklyWorkspaceJson => ({
    blocks: { languageVersion: 0, blocks: [{ type: 'arduino_loop', inputs: { DO: { block: block as never } } }] },
  });

  it('set_pwm lowers to analogWrite with a lowered value expression', () => {
    const { program, diagnostics } = lowerWorkspaceToIR(
      inLoop({
        type: 'set_pwm',
        fields: { PIN: 9 },
        inputs: { VALUE: { block: { type: 'num_value', fields: { NUM: 128 } } } },
      }),
    );
    expect(diagnostics).toEqual([]);
    expect(program.loop[0]).toMatchObject({ kind: 'analogWrite', pin: 'D9', value: { kind: 'num', value: 128 } });
    const { code } = printArduino(program);
    expect(code).toContain('analogWrite(9, 128);');
    expect(code).toContain('pinMode(9, OUTPUT);');
  });

  it('for_range lowers to forRange and its loop variable is not a global', () => {
    const workspace: BlocklyWorkspaceJson = {
      variables: [{ id: 'v-i', name: 'i' }],
      blocks: {
        languageVersion: 0,
        blocks: [
          {
            type: 'arduino_loop',
            inputs: {
              DO: {
                block: {
                  type: 'for_range',
                  fields: { VAR: { id: 'v-i' }, FROM: 0, TO: 10, BY: 2 },
                  inputs: { DO: { block: { type: 'set_pin', fields: { PIN: 13, STATE: 'HIGH' } } } },
                },
              },
            },
          },
        ],
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(workspace);
    expect(diagnostics).toEqual([]);
    expect(program.loop[0]).toMatchObject({
      kind: 'forRange',
      varName: 'i',
      from: { kind: 'num', value: 0 },
      to: { kind: 'num', value: 10 },
      step: { kind: 'num', value: 2 },
    });
    expect(program.globals.map((g) => g.name)).not.toContain('i');
    expect(printArduino(program).code).toContain('for (long i = 0; i <= 10; i += 2) {');
  });

  it('constrain, min/max, and abs lower to Arduino call expressions', () => {
    const constrained = {
      type: 'constrain_range',
      fields: { LOW: 0, HIGH: 255 },
      inputs: { VALUE: { block: { type: 'num_value', fields: { NUM: 300 } } } },
    };
    const minOf = {
      type: 'math_minmax',
      fields: { OP: 'MIN' },
      inputs: {
        A: { block: { type: 'num_value', fields: { NUM: 3 } } },
        B: { block: { type: 'math_abs', inputs: { VALUE: { block: { type: 'num_value', fields: { NUM: -7 } } } } } },
      },
    };
    const { program, diagnostics } = lowerWorkspaceToIR(
      inLoop({ type: 'set_pwm', fields: { PIN: 9 }, inputs: { VALUE: { block: constrained } } }),
    );
    expect(diagnostics).toEqual([]);
    expect(program.loop[0]).toMatchObject({
      kind: 'analogWrite',
      value: { kind: 'call', fn: 'constrain', args: [{ kind: 'num', value: 300 }, { kind: 'num', value: 0 }, { kind: 'num', value: 255 }] },
    });

    const minLowered = lowerWorkspaceToIR(
      inLoop({ type: 'set_pwm', fields: { PIN: 9 }, inputs: { VALUE: { block: minOf } } }),
    );
    expect(minLowered.diagnostics).toEqual([]);
    expect(minLowered.program.loop[0]).toMatchObject({
      kind: 'analogWrite',
      value: {
        kind: 'call',
        fn: 'min',
        args: [{ kind: 'num', value: 3 }, { kind: 'call', fn: 'abs', args: [{ kind: 'num', value: -7 }] }],
      },
    });
    expect(printArduino(minLowered.program).code).toContain('analogWrite(9, min(3, abs(-7)));');
  });

  it('comment_note lowers to a comment statement and prints as //', () => {
    const { program, diagnostics } = lowerWorkspaceToIR(
      inLoop({ type: 'comment_note', fields: { TEXT: 'blink twice per second' } }),
    );
    expect(diagnostics).toEqual([]);
    expect(program.loop[0]).toMatchObject({ kind: 'comment', text: 'blink twice per second' });
    expect(printArduino(program).code).toContain('  // blink twice per second');
  });
});
