/**
 * Blocks → IR lowering (implemenation_plam/codegen.md §6, ADR-0003).
 *
 * A pure function over the Blockly JSON serialization plus the placed
 * components (never the live workspace), so it runs headless and is
 * trivially testable. The C printer and the simulator both consume the
 * ProgramIR this produces — one meaning per program, no drift.
 *
 * Component rules (never hardcode polarity):
 * - LED "on" writes the instance's `activeHigh` level; active-low LEDs
 *   emit the opposite write.
 * - "is pressed?" reads the instance's `pullMode`: internal pull-up means
 *   pressed reads LOW; external pull-down means pressed reads HIGH.
 * - Raw `read_pin` implies INPUT_PULLUP, matching real beginner wiring:
 *   an unpressed button reads HIGH — the teachable moment lessons build on.
 */
import { buttonUsesPullup, ledIsActiveHigh, signalPin } from '../hardware/components';
import type { Diagnostic, PinId } from '../hardware/types';
import type { ExpressionIR, ProgramIR, StatementIR } from '../ir/types';
import type { ComponentInstance } from '../persistence/projectDocument';
import { NO_COMPONENT } from '../blocks/componentRegistry';

export type BlocklyBlockJson = {
  type: string;
  id?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: BlocklyBlockJson; shadow?: BlocklyBlockJson }>;
  next?: { block?: BlocklyBlockJson };
  x?: number;
  y?: number;
};

export type BlocklyWorkspaceJson = {
  blocks?: { languageVersion?: number; blocks?: BlocklyBlockJson[] };
  variables?: unknown[];
};

export type LowerResult = {
  program: ProgramIR;
  diagnostics: Diagnostic[];
};

type Ctx = {
  diagnostics: Diagnostic[];
  componentsById: Map<string, ComponentInstance>;
  /** Input pins used by reads — lowered to inferred pinMode nodes in setup(). */
  inferredInputModes: Map<PinId, 'INPUT' | 'INPUT_PULLUP'>;
  /** Blockly variable id → user-visible name (from the workspace JSON). */
  variableNames: Map<string, string>;
  /** Variables actually referenced — emitted as globals (codegen.md §6). */
  usedVariables: Set<string>;
  /** for-range loop variables — declared by the for statement itself, so
   * they are excluded from the globals (reads inside the body resolve to
   * the loop-local in the printed C). */
  loopVariables: Set<string>;
  /** One servoAttach per used servo instance, emitted into setup(). */
  servoAttaches: Map<string, StatementIR>;
};

const ARITH_OPS: Record<string, '+' | '-' | '*' | '/' | '%'> = {
  ADD: '+', SUB: '-', MUL: '*', DIV: '/', MOD: '%',
};
const COMPARE_OPS: Record<string, '==' | '!=' | '<' | '<=' | '>' | '>='> = {
  EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=',
};
const NEGATED_COMPARE: Record<string, '==' | '!=' | '<' | '<=' | '>' | '>='> = {
  '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<',
};

/** `wait until c` prints as `while (!c) { }`; fold the negation into a
 * comparison when possible so beginners read `!= ` instead of `!(...)`. */
function negateExpression(expr: ExpressionIR): ExpressionIR {
  if (expr.kind === 'binary' && expr.op in NEGATED_COMPARE) {
    return { ...expr, op: NEGATED_COMPARE[expr.op] };
  }
  return { kind: 'unary', op: 'not', arg: expr };
}

function numField(block: BlocklyBlockJson, name: string, fallback: number): number {
  const value = block.fields?.[name];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function strField(block: BlocklyBlockJson, name: string, fallback: string): string {
  const value = block.fields?.[name];
  return typeof value === 'string' ? value : fallback;
}

function digitalPin(raw: number, ctx: Ctx, blockId?: string): PinId {
  const clamped = Math.min(13, Math.max(0, Math.trunc(raw)));
  if (clamped !== raw) {
    ctx.diagnostics.push({
      id: `pin-out-of-range:${blockId ?? 'unknown'}`,
      severity: 'warning',
      title: 'Pin out of range',
      message: `Pin ${raw} is not a digital pin on the Arduino Uno; using D${clamped} instead.`,
      source: { blockId },
    });
  }
  return `D${clamped}` as PinId;
}

function inputBlock(block: BlocklyBlockJson, name: string): BlocklyBlockJson | undefined {
  const input = block.inputs?.[name];
  return input?.block ?? input?.shadow;
}

/** field_variable serializes as `{ id }`; resolve to the variable's name. */
function varField(block: BlocklyBlockJson, name: string, ctx: Ctx): string | null {
  const raw = block.fields?.[name];
  const id =
    typeof raw === 'object' && raw !== null && 'id' in raw ? String((raw as { id: unknown }).id) : null;
  const resolved = id !== null ? ctx.variableNames.get(id) : typeof raw === 'string' ? raw : null;
  if (!resolved) {
    ctx.diagnostics.push({
      id: `unknown-variable:${block.id ?? block.type}`,
      severity: 'error',
      title: 'Unknown variable',
      message: 'This block refers to a variable that no longer exists. Pick or create one in the dropdown.',
      source: { blockId: block.id },
    });
    return null;
  }
  ctx.usedVariables.add(resolved);
  return resolved;
}

/**
 * Resolves a component dropdown to a placed instance with a pin, reporting
 * a teaching diagnostic when it cannot. Returns null when the block should
 * be skipped/fall back.
 */
function resolveComponent(
  block: BlocklyBlockJson,
  expectedType: ComponentInstance['type'],
  label: string,
  ctx: Ctx,
): { instance: ComponentInstance; pin: PinId } | null {
  const componentId = strField(block, 'COMPONENT', NO_COMPONENT);
  const instance = componentId === NO_COMPONENT ? undefined : ctx.componentsById.get(componentId);
  if (!instance || instance.type !== expectedType) {
    ctx.diagnostics.push({
      id: `missing-component:${block.id ?? block.type}`,
      severity: 'error',
      title: `No ${label} for this block`,
      message: `This "${block.type}" block does not target a placed ${label}. Add one in the hardware panel, then pick it in the block.`,
      source: { blockId: block.id },
    });
    return null;
  }
  const pin = signalPin(instance);
  if (!pin) {
    ctx.diagnostics.push({
      id: `component-unpinned:${instance.id}`,
      severity: 'error',
      title: `${instance.displayName} has no pin`,
      message: `${instance.displayName} is not connected to a pin yet, so this block does nothing.`,
      source: { blockId: block.id, componentId: instance.id },
    });
    return null;
  }
  return { instance, pin };
}

function lowerValue(block: BlocklyBlockJson | undefined, fallback: ExpressionIR, ctx: Ctx): ExpressionIR {
  if (!block) return fallback;
  switch (block.type) {
    case 'read_pin': {
      const pin = digitalPin(numField(block, 'PIN', 2), ctx, block.id);
      if (!ctx.inferredInputModes.has(pin)) ctx.inferredInputModes.set(pin, 'INPUT_PULLUP');
      return { kind: 'read', op: 'digital', pin };
    }
    case 'button_is_pressed': {
      const resolved = resolveComponent(block, 'button', 'Button', ctx);
      if (!resolved) return fallback;
      const pullup = buttonUsesPullup(resolved.instance);
      if (!ctx.inferredInputModes.has(resolved.pin)) {
        ctx.inferredInputModes.set(resolved.pin, pullup ? 'INPUT_PULLUP' : 'INPUT');
      }
      // Pull-up: pressed reads LOW. Pull-down: pressed reads HIGH.
      return {
        kind: 'binary',
        op: '==',
        left: { kind: 'read', op: 'digital', pin: resolved.pin },
        right: { kind: 'bool', value: !pullup },
      };
    }
    case 'pot_read': {
      const resolved = resolveComponent(block, 'potentiometer', 'Potentiometer', ctx);
      if (!resolved) return fallback;
      return { kind: 'read', op: 'analog', pin: resolved.pin };
    }
    case 'pot_map': {
      const resolved = resolveComponent(block, 'potentiometer', 'Potentiometer', ctx);
      if (!resolved) return fallback;
      return {
        kind: 'call',
        fn: 'map',
        args: [
          { kind: 'read', op: 'analog', pin: resolved.pin },
          { kind: 'num', value: 0 },
          { kind: 'num', value: 1023 },
          { kind: 'num', value: numField(block, 'LOW', 0) },
          { kind: 'num', value: numField(block, 'HIGH', 255) },
        ],
      };
    }
    case 'pot_above': {
      const resolved = resolveComponent(block, 'potentiometer', 'Potentiometer', ctx);
      if (!resolved) return fallback;
      return {
        kind: 'binary',
        op: '>',
        left: { kind: 'read', op: 'analog', pin: resolved.pin },
        right: { kind: 'num', value: numField(block, 'THRESHOLD', 512) },
      };
    }
    case 'string_text':
      return { kind: 'string', value: strField(block, 'TEXT', '') };
    case 'num_value':
      return { kind: 'num', value: numField(block, 'NUM', 0) };
    case 'math_arith': {
      const op = ARITH_OPS[strField(block, 'OP', 'ADD')] ?? '+';
      return {
        kind: 'binary',
        op,
        left: lowerValue(inputBlock(block, 'A'), { kind: 'num', value: 0 }, ctx),
        right: lowerValue(inputBlock(block, 'B'), { kind: 'num', value: 0 }, ctx),
      };
    }
    case 'compare_op': {
      const op = COMPARE_OPS[strField(block, 'OP', 'EQ')] ?? '==';
      return {
        kind: 'binary',
        op,
        left: lowerValue(inputBlock(block, 'A'), { kind: 'num', value: 0 }, ctx),
        right: lowerValue(inputBlock(block, 'B'), { kind: 'num', value: 0 }, ctx),
      };
    }
    case 'logic_andor':
      return {
        kind: 'binary',
        op: strField(block, 'OP', 'AND') === 'OR' ? '||' : '&&',
        left: lowerValue(inputBlock(block, 'A'), { kind: 'bool', value: false }, ctx),
        right: lowerValue(inputBlock(block, 'B'), { kind: 'bool', value: false }, ctx),
      };
    case 'not_op':
      return {
        kind: 'unary',
        op: 'not',
        arg: lowerValue(inputBlock(block, 'BOOL'), { kind: 'bool', value: false }, ctx),
      };
    case 'var_get': {
      const name = varField(block, 'VAR', ctx);
      return name === null ? fallback : { kind: 'var', name };
    }
    case 'millis_now':
      return { kind: 'millis' };
    case 'random_range': {
      const from = Math.trunc(numField(block, 'FROM', 1));
      const to = Math.trunc(numField(block, 'TO', 10));
      // Arduino random(min, max) excludes max; the block is inclusive.
      return { kind: 'call', fn: 'random', args: [{ kind: 'num', value: from }, { kind: 'num', value: to + 1 }] };
    }
    case 'constrain_range':
      return {
        kind: 'call',
        fn: 'constrain',
        args: [
          lowerValue(inputBlock(block, 'VALUE'), { kind: 'num', value: 0 }, ctx),
          { kind: 'num', value: numField(block, 'LOW', 0) },
          { kind: 'num', value: numField(block, 'HIGH', 255) },
        ],
      };
    case 'math_minmax':
      return {
        kind: 'call',
        fn: strField(block, 'OP', 'MIN') === 'MAX' ? 'max' : 'min',
        args: [
          lowerValue(inputBlock(block, 'A'), { kind: 'num', value: 0 }, ctx),
          lowerValue(inputBlock(block, 'B'), { kind: 'num', value: 0 }, ctx),
        ],
      };
    case 'math_abs':
      return {
        kind: 'call',
        fn: 'abs',
        args: [lowerValue(inputBlock(block, 'VALUE'), { kind: 'num', value: 0 }, ctx)],
      };
    case 'map_range':
      return {
        kind: 'call',
        fn: 'map',
        args: [
          lowerValue(inputBlock(block, 'VALUE'), { kind: 'num', value: 0 }, ctx),
          { kind: 'num', value: numField(block, 'FROMLOW', 0) },
          { kind: 'num', value: numField(block, 'FROMHIGH', 1023) },
          { kind: 'num', value: numField(block, 'TOLOW', 0) },
          { kind: 'num', value: numField(block, 'TOHIGH', 255) },
        ],
      };
    default:
      ctx.diagnostics.push({
        id: `unsupported-value-block:${block.type}`,
        severity: 'warning',
        title: 'Unsupported block',
        message: `The block "${block.type}" is not supported yet and was ignored.`,
        source: { blockId: block.id },
      });
      return fallback;
  }
}

function lowerStatement(block: BlocklyBlockJson, ctx: Ctx): StatementIR[] {
  switch (block.type) {
    case 'set_pin': {
      const pin = digitalPin(numField(block, 'PIN', 13), ctx, block.id);
      const high = strField(block, 'STATE', 'HIGH') === 'HIGH';
      return [{ kind: 'digitalWrite', pin, value: { kind: 'bool', value: high } }];
    }
    case 'led_set': {
      const resolved = resolveComponent(block, 'led', 'LED', ctx);
      if (!resolved) return [];
      const on = strField(block, 'STATE', 'ON') === 'ON';
      const activeHigh = ledIsActiveHigh(resolved.instance);
      // "on" means the LED lights — the electrical level depends on wiring.
      const level = on ? activeHigh : !activeHigh;
      return [{ kind: 'digitalWrite', pin: resolved.pin, value: { kind: 'bool', value: level } }];
    }
    case 'led_brightness': {
      const resolved = resolveComponent(block, 'led', 'LED', ctx);
      if (!resolved) return [];
      const value = lowerValue(inputBlock(block, 'VALUE'), { kind: 'num', value: 0 }, ctx);
      // Active-low wiring inverts brightness: full value means off. Emit the
      // honest arithmetic instead of pretending polarity away.
      const written: ExpressionIR = ledIsActiveHigh(resolved.instance)
        ? value
        : { kind: 'binary', op: '-', left: { kind: 'num', value: 255 }, right: value };
      return [{ kind: 'analogWrite', pin: resolved.pin, value: written }];
    }
    case 'led_blink': {
      const resolved = resolveComponent(block, 'led', 'LED', ctx);
      if (!resolved) return [];
      const ms: ExpressionIR = { kind: 'num', value: Math.max(0, numField(block, 'MS', 500)) };
      const activeHigh = ledIsActiveHigh(resolved.instance);
      return [
        { kind: 'digitalWrite', pin: resolved.pin, value: { kind: 'bool', value: activeHigh } },
        { kind: 'delay', ms },
        { kind: 'digitalWrite', pin: resolved.pin, value: { kind: 'bool', value: !activeHigh } },
        { kind: 'delay', ms },
      ];
    }
    case 'button_wait': {
      const resolved = resolveComponent(block, 'button', 'Button', ctx);
      if (!resolved) return [];
      const pullup = buttonUsesPullup(resolved.instance);
      if (!ctx.inferredInputModes.has(resolved.pin)) {
        ctx.inferredInputModes.set(resolved.pin, pullup ? 'INPUT_PULLUP' : 'INPUT');
      }
      // Spin while the line still reads its unpressed level (pull-up idles
      // HIGH, pull-down idles LOW) — a real spin-wait, printed honestly.
      return [
        {
          kind: 'while',
          condition: {
            kind: 'binary',
            op: '==',
            left: { kind: 'read', op: 'digital', pin: resolved.pin },
            right: { kind: 'bool', value: pullup },
          },
          body: [],
        },
      ];
    }
    case 'buzzer_play': {
      const resolved = resolveComponent(block, 'buzzer', 'Buzzer', ctx);
      if (!resolved) return [];
      return [
        {
          kind: 'tone',
          pin: resolved.pin,
          frequency: { kind: 'num', value: Math.max(0, numField(block, 'FREQ', 440)) },
        },
      ];
    }
    case 'buzzer_stop': {
      const resolved = resolveComponent(block, 'buzzer', 'Buzzer', ctx);
      if (!resolved) return [];
      return [{ kind: 'noTone', pin: resolved.pin }];
    }
    case 'servo_set_angle': {
      const resolved = resolveComponent(block, 'servo', 'Servo', ctx);
      if (!resolved) return [];
      const servoId = resolved.instance.displayName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'servo';
      if (!ctx.servoAttaches.has(resolved.instance.id)) {
        ctx.servoAttaches.set(resolved.instance.id, { kind: 'servoAttach', servoId, pin: resolved.pin });
      }
      let angle = lowerValue(inputBlock(block, 'ANGLE'), { kind: 'num', value: 90 }, ctx);
      // Real Servo.write clamps to 0–180; clamp literals so the preview
      // shows the value the servo will actually take.
      if (angle.kind === 'num') angle = { kind: 'num', value: Math.min(180, Math.max(0, angle.value)) };
      return [{ kind: 'servoWrite', servoId, angle }];
    }
    case 'set_pwm': {
      const pin = digitalPin(numField(block, 'PIN', 9), ctx, block.id);
      return [
        { kind: 'analogWrite', pin, value: lowerValue(inputBlock(block, 'VALUE'), { kind: 'num', value: 0 }, ctx) },
      ];
    }
    case 'for_range': {
      const name = varField(block, 'VAR', ctx);
      if (name === null) return [];
      ctx.loopVariables.add(name);
      return [
        {
          kind: 'forRange',
          varName: name,
          from: { kind: 'num', value: numField(block, 'FROM', 0) },
          to: { kind: 'num', value: numField(block, 'TO', 10) },
          step: { kind: 'num', value: numField(block, 'BY', 1) },
          body: lowerChain(inputBlock(block, 'DO'), ctx),
        },
      ];
    }
    case 'comment_note':
      return [{ kind: 'comment', text: strField(block, 'TEXT', '') }];
    case 'delay_ms':
      return [{ kind: 'delay', ms: { kind: 'num', value: Math.max(0, numField(block, 'DELAY', 0)) } }];
    case 'repeat_times':
      return [
        {
          kind: 'repeat',
          times: { kind: 'num', value: Math.max(0, Math.trunc(numField(block, 'TIMES', 0))) },
          body: lowerChain(inputBlock(block, 'DO'), ctx),
        },
      ];
    case 'if_do':
      return [
        {
          kind: 'if',
          condition: lowerValue(inputBlock(block, 'CONDITION'), { kind: 'bool', value: false }, ctx),
          then: lowerChain(inputBlock(block, 'DO'), ctx),
        },
      ];
    case 'serial_print':
      return [
        {
          kind: 'serialPrint',
          value: lowerValue(inputBlock(block, 'VALUE'), { kind: 'string', value: '' }, ctx),
          newline: true,
        },
      ];
    case 'if_else':
      return [
        {
          kind: 'if',
          condition: lowerValue(inputBlock(block, 'CONDITION'), { kind: 'bool', value: false }, ctx),
          then: lowerChain(inputBlock(block, 'DO'), ctx),
          else: lowerChain(inputBlock(block, 'ELSE'), ctx),
        },
      ];
    case 'wait_until': {
      const condition = lowerValue(inputBlock(block, 'CONDITION'), { kind: 'bool', value: true }, ctx);
      // A real spin-wait: while (!condition) { } — honest Arduino semantics
      // (codegen.md §9); the runtime's loop budget keeps it cooperative.
      return [{ kind: 'while', condition: negateExpression(condition), body: [] }];
    }
    case 'var_set': {
      const name = varField(block, 'VAR', ctx);
      if (name === null) return [];
      return [{ kind: 'assign', name, value: lowerValue(inputBlock(block, 'VALUE'), { kind: 'num', value: 0 }, ctx) }];
    }
    case 'var_change': {
      const name = varField(block, 'VAR', ctx);
      if (name === null) return [];
      return [{ kind: 'change', name, delta: lowerValue(inputBlock(block, 'DELTA'), { kind: 'num', value: 1 }, ctx) }];
    }
    default:
      ctx.diagnostics.push({
        id: `unsupported-statement-block:${block.type}`,
        severity: 'warning',
        title: 'Unsupported block',
        message: `The block "${block.type}" is not supported yet and was skipped.`,
        source: { blockId: block.id },
      });
      return [];
  }
}

function lowerChain(first: BlocklyBlockJson | undefined, ctx: Ctx): StatementIR[] {
  const statements: StatementIR[] = [];
  for (let block = first; block; block = block.next?.block) {
    for (const stmt of lowerStatement(block, ctx)) {
      // Tag the statements this block directly produced (nested bodies were
      // tagged by their own blocks) so the printer can build the source map.
      statements.push(block.id !== undefined ? { ...stmt, sourceBlockId: block.id } : stmt);
    }
  }
  return statements;
}

export function lowerWorkspaceToIR(
  json: BlocklyWorkspaceJson,
  components: ComponentInstance[] = [],
): LowerResult {
  const variableNames = new Map<string, string>();
  for (const entry of json.variables ?? []) {
    if (typeof entry === 'object' && entry !== null) {
      const { id, name } = entry as { id?: unknown; name?: unknown };
      if (typeof id === 'string' && typeof name === 'string') variableNames.set(id, name);
    }
  }

  const ctx: Ctx = {
    diagnostics: [],
    componentsById: new Map(components.map((c) => [c.id, c])),
    inferredInputModes: new Map(),
    variableNames,
    usedVariables: new Set(),
    loopVariables: new Set(),
    servoAttaches: new Map(),
  };
  const setup: StatementIR[] = [];
  const loop: StatementIR[] = [];

  for (const top of json.blocks?.blocks ?? []) {
    if (top.type === 'arduino_setup') {
      setup.push(...lowerChain(inputBlock(top, 'DO'), ctx));
    } else if (top.type === 'arduino_loop') {
      loop.push(...lowerChain(inputBlock(top, 'DO'), ctx));
    } else {
      // v1 behavior: orphan top-level statement blocks run in loop().
      const orphaned = lowerChain(top, ctx);
      if (orphaned.length > 0) {
        loop.push(...orphaned);
        ctx.diagnostics.push({
          id: `orphan-top-block:${top.id ?? top.type}`,
          severity: 'info',
          title: 'Block outside setup/loop',
          message: `"${top.type}" is not inside a setup or loop block; it will run in loop().`,
          source: { blockId: top.id },
        });
      }
    }
  }

  const inputModes: StatementIR[] = [...ctx.inferredInputModes.entries()]
    .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(([pin, mode]) => ({ kind: 'pinMode', pin, mode, explicit: false }));

  // Beginner variables are globals with a zero initializer so counters
  // persist across loop() passes (codegen.md §6); sorted for determinism.
  const globals = [...ctx.usedVariables]
    .filter((name) => !ctx.loopVariables.has(name))
    .sort()
    .map((name) => ({ name, valueType: 'number' as const, initial: { kind: 'num', value: 0 } as const }));

  return {
    program: {
      schemaVersion: 1,
      boardId: 'arduino-uno',
      includes: [],
      globals,
      setup: [...inputModes, ...ctx.servoAttaches.values(), ...setup],
      loop,
      // Fixed metadata: the printer must stay a deterministic function of
      // the workspace content (generated C is cache, not truth).
      metadata: {
        sourceProjectHash: 'workspace',
        generatedAt: '1970-01-01T00:00:00.000Z',
        generatorVersion: '0.1.0-phase1',
      },
    },
    diagnostics: ctx.diagnostics,
  };
}
