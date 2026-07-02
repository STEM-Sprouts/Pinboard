/**
 * Generator interpreter (implemenation_plam/runtime.md §3–4).
 *
 * The interpreter yields control instead of blocking:
 * - `delay` yields a target virtual time; it never advances the clock itself
 *   (the scheduler owns the clock, preventing double-counting).
 * - Every loop back-edge (`while`, `repeat`, `forRange`, top-level `loop()`)
 *   yields `cooperative` after `ctx.budgetPerTick` iterations so a tight
 *   `while(true)` can never freeze the tab.
 */
import type { PinId } from '../hardware/types';
import type { GlobalIR, ProgramIR, StatementIR, ValueType } from '../ir/types';
import type { RuntimeContext, RuntimeValue, RuntimeYield } from './types';
import { RuntimeError, asNumber, evaluate, setVar, truthy, type LocalScopes } from './expressions';

type InterpreterState = {
  servoBindings: Map<string, PinId>;
  missingServosReported: Set<string>;
};

function defaultValue(valueType: ValueType): RuntimeValue {
  switch (valueType) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'string':
      return '';
  }
}

function initGlobals(globals: GlobalIR[], ctx: RuntimeContext): void {
  for (const global of globals) {
    const value = global.initial !== undefined ? evaluate(global.initial, ctx, []) : defaultValue(global.valueType);
    ctx.globals.set(global.name, value);
  }
}

/** Arduino `Serial.print` formatting: booleans print as 1/0, floats with 2 decimals. */
function formatSerialValue(value: RuntimeValue): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return value;
}

export function* executeProgram(program: ProgramIR, ctx: RuntimeContext): Generator<RuntimeYield, void, void> {
  const state: InterpreterState = {
    servoBindings: new Map(),
    missingServosReported: new Set(),
  };
  initGlobals(program.globals, ctx);
  yield* executeStatements(program.setup, ctx, state, []);
  if (program.loop.length === 0) return;
  for (;;) {
    yield* executeStatements(program.loop, ctx, state, []);
    yield { type: 'cooperative' };
  }
}

function* executeStatements(
  statements: StatementIR[],
  ctx: RuntimeContext,
  state: InterpreterState,
  locals: LocalScopes,
): Generator<RuntimeYield, void, void> {
  for (const statement of statements) {
    yield* executeStatement(statement, ctx, state, locals);
  }
}

function* executeStatement(
  stmt: StatementIR,
  ctx: RuntimeContext,
  state: InterpreterState,
  locals: LocalScopes,
): Generator<RuntimeYield, void, void> {
  const now = () => ctx.clock.virtualTimeMs;

  switch (stmt.kind) {
    case 'declare': {
      const value = stmt.initial !== undefined ? evaluate(stmt.initial, ctx, locals) : defaultValue(stmt.valueType);
      // Beginner variables are globals; a local declare without an enclosing
      // scope frame (only forRange creates one) also lands in globals.
      const target = stmt.scope === 'local' && locals.length > 0 ? locals[locals.length - 1] : ctx.globals;
      target.set(stmt.name, value);
      return;
    }
    case 'assign':
      setVar(stmt.name, evaluate(stmt.value, ctx, locals), ctx, locals);
      return;
    case 'change': {
      const current = asNumber(evaluate({ kind: 'var', name: stmt.name }, ctx, locals));
      setVar(stmt.name, current + asNumber(evaluate(stmt.delta, ctx, locals)), ctx, locals);
      return;
    }
    case 'pinMode':
      ctx.pins.setMode(stmt.pin, stmt.mode, now());
      return;
    case 'digitalWrite':
      ctx.pins.writeDigital(stmt.pin, truthy(evaluate(stmt.value, ctx, locals)), now());
      return;
    case 'analogWrite':
      ctx.pins.writePwm(stmt.pin, asNumber(evaluate(stmt.value, ctx, locals)), now());
      return;
    case 'delay': {
      const ms = asNumber(evaluate(stmt.ms, ctx, locals));
      if (ms > 0) yield { type: 'waitUntilTime', targetTimeMs: ctx.clock.virtualTimeMs + ms };
      return;
    }
    case 'delayMicroseconds': {
      const ms = asNumber(evaluate(stmt.us, ctx, locals)) / 1000;
      if (ms > 0) yield { type: 'waitUntilTime', targetTimeMs: ctx.clock.virtualTimeMs + ms };
      return;
    }
    case 'serialPrint': {
      const text = formatSerialValue(evaluate(stmt.value, ctx, locals));
      if (stmt.newline) ctx.serial.println(text);
      else ctx.serial.print(text);
      return;
    }
    case 'tone': {
      const frequency = asNumber(evaluate(stmt.frequency, ctx, locals));
      const duration = stmt.durationMs !== undefined ? asNumber(evaluate(stmt.durationMs, ctx, locals)) : undefined;
      ctx.pins.setTone(stmt.pin, frequency, now(), duration);
      return;
    }
    case 'noTone':
      ctx.pins.clearTone(stmt.pin, now());
      return;
    case 'servoAttach':
      state.servoBindings.set(stmt.servoId, stmt.pin);
      return;
    case 'servoWrite': {
      const pin = state.servoBindings.get(stmt.servoId);
      if (pin === undefined) {
        if (!state.missingServosReported.has(stmt.servoId)) {
          state.missingServosReported.add(stmt.servoId);
          ctx.diagnostics.report({
            id: `servo-not-attached:${stmt.servoId}`,
            severity: 'warning',
            title: 'Servo is not attached',
            message: `The servo "${stmt.servoId}" was never attached to a pin, so this write does nothing.`,
          });
        }
        return;
      }
      ctx.pins.writeServoAngle(pin, asNumber(evaluate(stmt.angle, ctx, locals)), now());
      return;
    }
    case 'if': {
      if (truthy(evaluate(stmt.condition, ctx, locals))) {
        yield* executeStatements(stmt.then, ctx, state, locals);
      } else if (stmt.else) {
        yield* executeStatements(stmt.else, ctx, state, locals);
      }
      return;
    }
    case 'repeat': {
      const times = Math.trunc(asNumber(evaluate(stmt.times, ctx, locals)));
      let iterations = 0;
      for (let i = 0; i < times; i++) {
        yield* executeStatements(stmt.body, ctx, state, locals);
        iterations++;
        if (iterations >= ctx.budgetPerTick) {
          iterations = 0;
          yield { type: 'cooperative' };
        }
      }
      return;
    }
    case 'while': {
      let iterations = 0;
      while (truthy(evaluate(stmt.condition, ctx, locals))) {
        yield* executeStatements(stmt.body, ctx, state, locals);
        iterations++;
        if (iterations >= ctx.budgetPerTick) {
          iterations = 0;
          yield { type: 'cooperative' };
        }
      }
      return;
    }
    case 'forRange': {
      const from = asNumber(evaluate(stmt.from, ctx, locals));
      const to = asNumber(evaluate(stmt.to, ctx, locals));
      const step = asNumber(evaluate(stmt.step, ctx, locals));
      const frame = new Map<string, RuntimeValue>([[stmt.varName, from]]);
      const bodyLocals: LocalScopes = [...locals, frame];
      const continues = (value: number) => (step >= 0 ? value <= to : value >= to);
      let iterations = 0;
      for (let i = from; continues(i); i += step) {
        frame.set(stmt.varName, i);
        yield* executeStatements(stmt.body, ctx, state, bodyLocals);
        // The loop variable is re-read so body assignments to it behave like C.
        const updated = frame.get(stmt.varName);
        if (updated !== undefined) i = asNumber(updated);
        iterations++;
        // A zero step never terminates in C either; the budget yield above
        // keeps it cooperative forever instead of freezing.
        if (iterations >= ctx.budgetPerTick) {
          iterations = 0;
          yield { type: 'cooperative' };
        }
      }
      return;
    }
    case 'comment':
      return;
  }
  throw new RuntimeError(`Unsupported statement: ${JSON.stringify(stmt)}`);
}
