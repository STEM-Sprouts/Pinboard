/**
 * Small IR construction helpers so fixtures and tests read like programs
 * instead of JSON (implemenation_plam/ARCHITECTURE.md §8: src/testing/builders.ts).
 */
import type { PinId } from '../hardware/types';
import type {
  BinaryOp,
  CallFn,
  ExpressionIR,
  GlobalIR,
  ProgramIR,
  StatementIR,
  ValueType,
} from '../ir/types';

type NumLike = number | ExpressionIR;

const expr = (value: NumLike): ExpressionIR => (typeof value === 'number' ? num(value) : value);

// --- expressions ---
export const num = (value: number): ExpressionIR => ({ kind: 'num', value });
export const bool = (value: boolean): ExpressionIR => ({ kind: 'bool', value });
export const str = (value: string): ExpressionIR => ({ kind: 'string', value });
export const variable = (name: string): ExpressionIR => ({ kind: 'var', name });
export const readDigital = (pin: PinId): ExpressionIR => ({ kind: 'read', op: 'digital', pin });
export const readAnalog = (pin: PinId): ExpressionIR => ({ kind: 'read', op: 'analog', pin });
export const millis = (): ExpressionIR => ({ kind: 'millis' });
export const not = (arg: ExpressionIR): ExpressionIR => ({ kind: 'unary', op: 'not', arg });
export const neg = (arg: ExpressionIR): ExpressionIR => ({ kind: 'unary', op: 'neg', arg });
export const bin = (op: BinaryOp, left: NumLike, right: NumLike): ExpressionIR => ({
  kind: 'binary',
  op,
  left: expr(left),
  right: expr(right),
});
export const call = (fn: CallFn, ...args: NumLike[]): ExpressionIR => ({
  kind: 'call',
  fn,
  args: args.map(expr),
});

// --- statements ---
export const declare = (
  name: string,
  valueType: ValueType,
  initial?: ExpressionIR,
  scope: 'global' | 'local' = 'global',
): StatementIR => ({ kind: 'declare', name, valueType, initial, scope });
export const assign = (name: string, value: NumLike): StatementIR => ({ kind: 'assign', name, value: expr(value) });
export const change = (name: string, delta: NumLike): StatementIR => ({ kind: 'change', name, delta: expr(delta) });
export const pinModeStmt = (
  pin: PinId,
  mode: 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT',
  explicit = false,
): StatementIR => ({ kind: 'pinMode', pin, mode, explicit });
export const digitalWrite = (pin: PinId, value: boolean | ExpressionIR): StatementIR => ({
  kind: 'digitalWrite',
  pin,
  value: typeof value === 'boolean' ? bool(value) : value,
});
export const analogWrite = (pin: PinId, value: NumLike): StatementIR => ({
  kind: 'analogWrite',
  pin,
  value: expr(value),
});
export const delayMs = (ms: NumLike): StatementIR => ({ kind: 'delay', ms: expr(ms) });
export const serialPrint = (value: ExpressionIR): StatementIR => ({ kind: 'serialPrint', value, newline: false });
export const serialPrintln = (value: ExpressionIR): StatementIR => ({ kind: 'serialPrint', value, newline: true });
export const iff = (condition: ExpressionIR, then: StatementIR[], elseBranch?: StatementIR[]): StatementIR => ({
  kind: 'if',
  condition,
  then,
  else: elseBranch,
});
export const repeat = (times: NumLike, body: StatementIR[]): StatementIR => ({
  kind: 'repeat',
  times: expr(times),
  body,
});
export const whileLoop = (condition: ExpressionIR, body: StatementIR[]): StatementIR => ({
  kind: 'while',
  condition,
  body,
});
export const forRange = (
  varName: string,
  from: NumLike,
  to: NumLike,
  step: NumLike,
  body: StatementIR[],
): StatementIR => ({ kind: 'forRange', varName, from: expr(from), to: expr(to), step: expr(step), body });
export const servoAttach = (servoId: string, pin: PinId): StatementIR => ({ kind: 'servoAttach', servoId, pin });
export const servoWrite = (servoId: string, angle: NumLike): StatementIR => ({
  kind: 'servoWrite',
  servoId,
  angle: expr(angle),
});

// --- globals & program ---
export const global = (name: string, valueType: ValueType, initial?: ExpressionIR): GlobalIR => ({
  name,
  valueType,
  initial,
});

export function program(parts: Partial<Pick<ProgramIR, 'boardId' | 'includes' | 'globals' | 'setup' | 'loop'>>): ProgramIR {
  return {
    schemaVersion: 1,
    boardId: parts.boardId ?? 'arduino-uno',
    includes: parts.includes ?? [],
    globals: parts.globals ?? [],
    setup: parts.setup ?? [],
    loop: parts.loop ?? [],
    // Fixed metadata keeps fixtures and printed output deterministic.
    metadata: {
      sourceProjectHash: 'fixture',
      generatedAt: '1970-01-01T00:00:00.000Z',
      generatorVersion: '0.1.0-phase0',
    },
  };
}

export const tone = (pin: PinId, frequency: ExpressionIR, durationMs?: ExpressionIR): StatementIR =>
  durationMs === undefined ? { kind: 'tone', pin, frequency } : { kind: 'tone', pin, frequency, durationMs };
export const noTone = (pin: PinId): StatementIR => ({ kind: 'noTone', pin });
