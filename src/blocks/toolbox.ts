/**
 * Editor-mode toolbox (persistence.md §2). The mode gates what the toolbox
 * OFFERS — it must never hide, delete, or fail to load blocks already in a
 * saved workspace; the caller updates the toolbox only, never the workspace.
 *
 * Tiers: beginner keeps the guided learning loop (components, control,
 * logic, basic math, serial); intermediate adds raw pins, variables, time,
 * and the wider math set; advanced is reserved for lower-level primitives
 * (explicit pinMode) and currently equals intermediate.
 */
import type { EditorMode } from '../persistence/projectDocument';

type ToolboxBlock = { kind: 'block'; type: string };
type ToolboxCategory = { kind: 'category'; name: string; colour: string; contents: ToolboxBlock[] };
export type ToolboxConfig = { kind: 'categoryToolbox'; contents: ToolboxCategory[] };

const MODE_RANK: Record<EditorMode, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Every toolbox block with the minimum mode that offers it. */
const CATEGORIES: Array<{
  name: string;
  colour: string;
  blocks: Array<{ type: string; minMode: EditorMode }>;
}> = [
  {
    name: 'Structure',
    colour: '#FFAB19',
    blocks: [
      { type: 'arduino_setup', minMode: 'beginner' },
      { type: 'arduino_loop', minMode: 'beginner' },
      { type: 'comment_note', minMode: 'beginner' },
    ],
  },
  {
    name: 'Components',
    colour: '#9966FF',
    blocks: [
      { type: 'led_set', minMode: 'beginner' },
      { type: 'led_brightness', minMode: 'beginner' },
      { type: 'led_blink', minMode: 'beginner' },
      { type: 'button_is_pressed', minMode: 'beginner' },
      { type: 'button_wait', minMode: 'beginner' },
      { type: 'pot_read', minMode: 'beginner' },
      { type: 'pot_map', minMode: 'beginner' },
      { type: 'pot_above', minMode: 'beginner' },
    ],
  },
  {
    name: 'Pins',
    colour: '#4C97FF',
    blocks: [
      { type: 'set_pin', minMode: 'intermediate' },
      { type: 'read_pin', minMode: 'intermediate' },
      { type: 'set_pwm', minMode: 'intermediate' },
    ],
  },
  {
    name: 'Control',
    colour: '#FFBF00',
    blocks: [
      { type: 'delay_ms', minMode: 'beginner' },
      { type: 'repeat_times', minMode: 'beginner' },
      { type: 'for_range', minMode: 'intermediate' },
    ],
  },
  {
    name: 'Logic',
    colour: '#59C059',
    blocks: [
      { type: 'if_do', minMode: 'beginner' },
      { type: 'if_else', minMode: 'beginner' },
      { type: 'compare_op', minMode: 'beginner' },
      { type: 'logic_andor', minMode: 'beginner' },
      { type: 'not_op', minMode: 'beginner' },
      { type: 'wait_until', minMode: 'intermediate' },
    ],
  },
  {
    name: 'Math',
    colour: '#59A869',
    blocks: [
      { type: 'num_value', minMode: 'beginner' },
      { type: 'math_arith', minMode: 'beginner' },
      { type: 'random_range', minMode: 'intermediate' },
      { type: 'map_range', minMode: 'intermediate' },
      { type: 'constrain_range', minMode: 'intermediate' },
      { type: 'math_minmax', minMode: 'intermediate' },
      { type: 'math_abs', minMode: 'intermediate' },
    ],
  },
  {
    name: 'Variables',
    colour: '#FF8C1A',
    blocks: [
      { type: 'var_set', minMode: 'intermediate' },
      { type: 'var_change', minMode: 'intermediate' },
      { type: 'var_get', minMode: 'intermediate' },
    ],
  },
  {
    name: 'Time',
    colour: '#FFBF00',
    blocks: [
      { type: 'delay_ms', minMode: 'beginner' },
      { type: 'millis_now', minMode: 'intermediate' },
    ],
  },
  {
    name: 'Serial',
    colour: '#5CB1D6',
    blocks: [
      { type: 'serial_print', minMode: 'beginner' },
      { type: 'string_text', minMode: 'beginner' },
    ],
  },
];

export function buildToolbox(mode: EditorMode): ToolboxConfig {
  const rank = MODE_RANK[mode];
  const contents: ToolboxCategory[] = [];
  for (const category of CATEGORIES) {
    const blocks = category.blocks
      .filter((block) => MODE_RANK[block.minMode] <= rank)
      .map((block) => ({ kind: 'block' as const, type: block.type }));
    if (blocks.length === 0) continue;
    contents.push({ kind: 'category', name: category.name, colour: category.colour, contents: blocks });
  }
  return { kind: 'categoryToolbox', contents };
}

export function toolboxBlockTypes(toolbox: ToolboxConfig): string[] {
  return toolbox.contents.flatMap((category) => category.contents.map((block) => block.type));
}
