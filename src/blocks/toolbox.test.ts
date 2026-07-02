/**
 * Editor-mode toolbox filtering (persistence.md §2, runtime test 18 in
 * testing.md): the mode decides what the toolbox OFFERS, never what a
 * loaded workspace contains. buildToolbox is a pure function of the mode.
 */
import { describe, expect, it } from 'vitest';
import { buildToolbox, toolboxBlockTypes } from './toolbox';

describe('editor-mode toolbox filtering', () => {
  it('beginner hides raw-pin, variable, and time blocks', () => {
    const types = toolboxBlockTypes(buildToolbox('beginner'));
    for (const hidden of ['set_pin', 'read_pin', 'set_pwm', 'var_set', 'var_get', 'millis_now', 'wait_until']) {
      expect(types, `${hidden} should be hidden in beginner`).not.toContain(hidden);
    }
    // The learning loop must stay completable: components, control, logic.
    for (const kept of ['led_set', 'led_brightness', 'pot_map', 'if_do', 'delay_ms', 'serial_print']) {
      expect(types, `${kept} should stay in beginner`).toContain(kept);
    }
  });

  it('intermediate exposes pins, variables, and time', () => {
    const types = toolboxBlockTypes(buildToolbox('intermediate'));
    for (const shown of ['set_pin', 'read_pin', 'set_pwm', 'var_set', 'var_get', 'millis_now', 'wait_until', 'for_range']) {
      expect(types).toContain(shown);
    }
  });

  it('each mode offers a superset of the mode below', () => {
    const beginner = new Set(toolboxBlockTypes(buildToolbox('beginner')));
    const intermediate = new Set(toolboxBlockTypes(buildToolbox('intermediate')));
    const advanced = new Set(toolboxBlockTypes(buildToolbox('advanced')));
    for (const t of beginner) expect(intermediate).toContain(t);
    for (const t of intermediate) expect(advanced).toContain(t);
  });

  it('is a pure function: same mode, same toolbox', () => {
    expect(buildToolbox('beginner')).toEqual(buildToolbox('beginner'));
    expect(buildToolbox('advanced')).toEqual(buildToolbox('advanced'));
  });
});
