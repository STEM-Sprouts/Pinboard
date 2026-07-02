/**
 * Lesson check evaluation (implemenation_plam/lessons.md §4).
 *
 * Structural checks read the project document and IR. Behavioral checks
 * (`runtimePinToggles`, `serialIncludes`) run the program headless on the
 * synthetic clock — the same deterministic harness the runtime tests use —
 * so "the LED really blinks" is verified by execution, not by grepping C.
 */
import type { PinId } from '../hardware/types';
import type { ProgramIR } from '../ir/types';
import { walkStatements } from '../ir/walk';
import type { PinboardProjectDocument } from '../persistence/projectDocument';
import { runHeadless } from '../testing/synthetic';
import type { LessonCheck } from './lessonTypes';

export type CheckContext = {
  document: PinboardProjectDocument;
  program: ProgramIR;
};

const TRACE_FRAMES = 800; // 4s of virtual time at the 5ms default step

function statementPin(stmt: { pin?: PinId }): PinId | undefined {
  return stmt.pin;
}

export async function evaluateCheck(check: LessonCheck, ctx: CheckContext): Promise<boolean> {
  switch (check.kind) {
    case 'hasComponent':
      return ctx.document.hardware.components.some((c) => c.type === check.componentType);

    case 'componentOnPin':
      return ctx.document.hardware.components.some(
        (c) => c.type === check.componentType && c.pins[check.pinRole] === check.expectedPin,
      );

    case 'hasInstruction': {
      let found = false;
      walkStatements([...ctx.program.setup, ...ctx.program.loop], (stmt) => {
        if (stmt.kind !== check.statementKind) return;
        if (check.pin !== undefined && statementPin(stmt as { pin?: PinId }) !== check.pin) return;
        found = true;
      });
      return found;
    }

    case 'serialIncludes': {
      const run = await runHeadless(ctx.program, { maxFrames: TRACE_FRAMES });
      return run.serialLines.some((line) => line.includes(check.text));
    }

    case 'runtimePinToggles': {
      const run = await runHeadless(ctx.program, { maxFrames: TRACE_FRAMES });
      const values = run.pinEvents
        .filter((event) => event.pin === check.pin && event.kind === 'digital')
        .map((event) => event.value);
      return new Set(values).size >= 2;
    }

    case 'runtimePinWritesPwm': {
      const run = await runHeadless(ctx.program, { maxFrames: TRACE_FRAMES });
      return run.pinEvents.some((event) => event.pin === check.pin && event.kind === 'pwm');
    }
  }
}

export async function evaluateAllChecks(
  checks: ReadonlyArray<{ id: string; check: LessonCheck }>,
  ctx: CheckContext,
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const { id, check } of checks) {
    results[id] = await evaluateCheck(check, ctx);
  }
  return results;
}
