/**
 * Canonical runtime types — the one home for `ClockSource`, `FrameScheduler`,
 * `RuntimeSchedulerDeps`, `RuntimeClock`, `RuntimeContext`
 * (see implemenation_plam/runtime.md §2).
 *
 * The clock and frame source are dependency-injected: the interpreter never
 * asks the browser for time — it only reads `ctx.clock.virtualTimeMs`. The
 * scheduler is the only layer allowed to consult `ClockSource` (ADR-0005).
 */
import type { BoardProfile, Diagnostic } from '../hardware/types';
import type { PinStateStore } from './pinState';
import type { SerialBuffer } from './serialBuffer';
import type { SeededRandom } from './seededRandom';

export type ClockSource = {
  nowMs(): number;
};

export type FrameScheduler = {
  nextFrame(): Promise<void>;
};

export type RuntimeSchedulerDeps = {
  clockSource: ClockSource;
  frameScheduler: FrameScheduler;
};

export type RuntimeClock = {
  virtualTimeMs: number;
  lastSourceTimeMs: number;
  speed: number;
  /** Clamp per tick so a backgrounded tab does not jump virtual time. */
  maxElapsedMsPerTick: number;
};

export type RuntimeValue = number | boolean | string;

export type DiagnosticSink = {
  report(diagnostic: Diagnostic): void;
};

export type RuntimeContext = {
  board: BoardProfile;
  pins: PinStateStore;
  serial: SerialBuffer;
  globals: Map<string, RuntimeValue>;
  clock: RuntimeClock;
  rng: SeededRandom;
  /** Loop iterations allowed between cooperative yields (back-edge budget). */
  budgetPerTick: number;
  diagnostics: DiagnosticSink;
};

/**
 * What the generator interpreter yields. `delay` yields a target time and
 * never advances the clock itself; loop back-edges yield `cooperative` so a
 * tight `while(true)` can never freeze the tab.
 */
export type RuntimeYield =
  | { type: 'waitUntilTime'; targetTimeMs: number }
  | { type: 'cooperative' };
