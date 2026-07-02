/**
 * IR expression evaluation (implemenation_plam/runtime.md, codegen.md §3).
 *
 * Determinism rules: time comes only from `ctx.clock.virtualTimeMs`, random
 * only from `ctx.rng`, and pin reads always consult the store at evaluation
 * time (never cached) so inputs applied between resumes are observed.
 */
import type { ExpressionIR } from '../ir/types';
import type { RuntimeContext, RuntimeValue } from './types';

/** Innermost scope last; variable lookup walks from the end, then globals. */
export type LocalScopes = ReadonlyArray<Map<string, RuntimeValue>>;

export class RuntimeError extends Error {}

export function truthy(value: RuntimeValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return value.length > 0;
}

export function asNumber(value: RuntimeValue): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  throw new RuntimeError(`Cannot use the text "${value}" as a number`);
}

export function lookupVar(name: string, ctx: RuntimeContext, locals: LocalScopes): RuntimeValue {
  for (let i = locals.length - 1; i >= 0; i--) {
    const scope = locals[i];
    if (scope.has(name)) return scope.get(name)!;
  }
  const global = ctx.globals.get(name);
  if (global === undefined) throw new RuntimeError(`Unknown variable "${name}"`);
  return global;
}

export function setVar(name: string, value: RuntimeValue, ctx: RuntimeContext, locals: LocalScopes): void {
  for (let i = locals.length - 1; i >= 0; i--) {
    const scope = locals[i];
    if (scope.has(name)) {
      scope.set(name, value);
      return;
    }
  }
  if (!ctx.globals.has(name)) throw new RuntimeError(`Unknown variable "${name}"`);
  ctx.globals.set(name, value);
}

function compareEquality(left: RuntimeValue, right: RuntimeValue): boolean {
  if (typeof left === typeof right) return left === right;
  return asNumber(left) === asNumber(right);
}

/** Arduino `map()` uses long integer math — division truncates toward zero. */
function arduinoMap(x: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin)) + outMin;
}

function evaluateCall(expr: Extract<ExpressionIR, { kind: 'call' }>, ctx: RuntimeContext, locals: LocalScopes): RuntimeValue {
  const args = expr.args.map((arg) => asNumber(evaluate(arg, ctx, locals)));
  const expectArgs = (count: number) => {
    if (args.length !== count) {
      throw new RuntimeError(`${expr.fn}() expects ${count} arguments, got ${args.length}`);
    }
  };
  switch (expr.fn) {
    case 'map':
      expectArgs(5);
      return arduinoMap(args[0], args[1], args[2], args[3], args[4]);
    case 'constrain':
      expectArgs(3);
      return Math.min(args[2], Math.max(args[1], args[0]));
    case 'min':
      expectArgs(2);
      return Math.min(args[0], args[1]);
    case 'max':
      expectArgs(2);
      return Math.max(args[0], args[1]);
    case 'abs':
      expectArgs(1);
      return Math.abs(args[0]);
    case 'random':
      // Arduino semantics: random(max) → [0, max), random(min, max) → [min, max).
      if (args.length === 1) return ctx.rng.nextInt(0, args[0]);
      expectArgs(2);
      return ctx.rng.nextInt(args[0], args[1]);
  }
}

export function evaluate(expr: ExpressionIR, ctx: RuntimeContext, locals: LocalScopes): RuntimeValue {
  switch (expr.kind) {
    case 'num':
      return expr.value;
    case 'bool':
      return expr.value;
    case 'string':
      return expr.value;
    case 'var':
      return lookupVar(expr.name, ctx, locals);
    case 'read':
      return expr.op === 'digital' ? ctx.pins.readDigital(expr.pin) : ctx.pins.readAnalog(expr.pin);
    case 'millis':
      return Math.floor(ctx.clock.virtualTimeMs);
    case 'unary':
      return expr.op === 'not'
        ? !truthy(evaluate(expr.arg, ctx, locals))
        : -asNumber(evaluate(expr.arg, ctx, locals));
    case 'binary': {
      if (expr.op === '&&') {
        return truthy(evaluate(expr.left, ctx, locals)) && truthy(evaluate(expr.right, ctx, locals));
      }
      if (expr.op === '||') {
        return truthy(evaluate(expr.left, ctx, locals)) || truthy(evaluate(expr.right, ctx, locals));
      }
      const left = evaluate(expr.left, ctx, locals);
      const right = evaluate(expr.right, ctx, locals);
      switch (expr.op) {
        case '==':
          return compareEquality(left, right);
        case '!=':
          return !compareEquality(left, right);
        case '<':
          return asNumber(left) < asNumber(right);
        case '<=':
          return asNumber(left) <= asNumber(right);
        case '>':
          return asNumber(left) > asNumber(right);
        case '>=':
          return asNumber(left) >= asNumber(right);
        case '+':
          return asNumber(left) + asNumber(right);
        case '-':
          return asNumber(left) - asNumber(right);
        case '*':
          return asNumber(left) * asNumber(right);
        case '/':
          return asNumber(left) / asNumber(right);
        case '%':
          return asNumber(left) % asNumber(right);
      }
      break;
    }
    case 'call':
      return evaluateCall(expr, ctx, locals);
  }
  throw new RuntimeError(`Unsupported expression: ${JSON.stringify(expr)}`);
}
