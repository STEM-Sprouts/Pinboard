/**
 * Runtime scheduler & the unified virtual clock (implemenation_plam/runtime.md §5, ADR-0005).
 *
 * The scheduler owns the one virtual clock. It receives `ClockSource` +
 * `FrameScheduler` and never calls `performance.now()` or
 * `requestAnimationFrame` directly — that is what lets the same runtime run
 * in the browser and headless in Node with deterministic timing.
 *
 * `millis()` reads `ctx.clock.virtualTimeMs`; `delay(ms)` yields a target
 * time and resumes only when the unified clock reaches it. Elapsed source
 * time is clamped per tick so a backgrounded tab cannot jump virtual time.
 */
import type { BoardProfile, Diagnostic } from '../hardware/types';
import type { ProgramIR } from '../ir/types';
import { executeProgram } from './interpreter';
import { PinStateStore } from './pinState';
import { SeededRandom } from './seededRandom';
import { SerialBuffer } from './serialBuffer';
import type { RuntimeContext, RuntimeSchedulerDeps, RuntimeYield } from './types';

export const DEFAULT_BUDGET_PER_TICK = 1000;
export const DEFAULT_MAX_ELAPSED_MS_PER_TICK = 100;
export const DEFAULT_SEED = 1;

export function advanceClock(ctx: RuntimeContext, nowSourceMs: number): void {
  const rawElapsedMs = Math.max(0, nowSourceMs - ctx.clock.lastSourceTimeMs);
  const elapsedMs = Math.min(rawElapsedMs, ctx.clock.maxElapsedMsPerTick);
  ctx.clock.virtualTimeMs += elapsedMs * ctx.clock.speed;
  ctx.clock.lastSourceTimeMs = nowSourceMs;
}

export type RuntimeSchedulerOptions = {
  board: BoardProfile;
  seed?: number;
  speed?: number;
  budgetPerTick?: number;
  maxElapsedMsPerTick?: number;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
};

export class RuntimeScheduler {
  readonly ctx: RuntimeContext;
  private deps: RuntimeSchedulerDeps;
  private generator: Generator<RuntimeYield, void, void> | null = null;
  private isRunning = false;
  private diagnosticsLog: Diagnostic[] = [];

  constructor(deps: RuntimeSchedulerDeps, options: RuntimeSchedulerOptions) {
    this.deps = deps;
    const onDiagnostic = options.onDiagnostic;
    const diagnosticsLog = this.diagnosticsLog;
    this.ctx = {
      board: options.board,
      pins: new PinStateStore(),
      serial: new SerialBuffer(),
      globals: new Map(),
      clock: {
        virtualTimeMs: 0,
        lastSourceTimeMs: 0,
        speed: options.speed ?? 1,
        maxElapsedMsPerTick: options.maxElapsedMsPerTick ?? DEFAULT_MAX_ELAPSED_MS_PER_TICK,
      },
      rng: new SeededRandom(options.seed ?? DEFAULT_SEED),
      budgetPerTick: options.budgetPerTick ?? DEFAULT_BUDGET_PER_TICK,
      diagnostics: {
        report(diagnostic: Diagnostic) {
          diagnosticsLog.push(diagnostic);
          onDiagnostic?.(diagnostic);
        },
      },
    };
  }

  get running(): boolean {
    return this.isRunning;
  }

  diagnostics(): readonly Diagnostic[] {
    return this.diagnosticsLog;
  }

  /**
   * Starts the program and resolves when it completes (setup-only programs)
   * or when `stop()` is called. Programs with a non-empty `loop` run until
   * stopped.
   */
  async run(program: ProgramIR): Promise<void> {
    if (this.isRunning) this.stop();
    this.generator = executeProgram(program, this.ctx);
    this.isRunning = true;
    try {
      await this.drive();
    } finally {
      this.isRunning = false;
      this.generator = null;
    }
  }

  /** Stop discards the generator and cancels pending waits. */
  stop(): void {
    this.isRunning = false;
  }

  /** Reset clears pins, serial, globals, RNG, diagnostics, and the clock. */
  reset(): void {
    this.stop();
    this.ctx.pins.reset();
    this.ctx.serial.clear();
    this.ctx.globals.clear();
    this.ctx.rng.reset();
    this.ctx.clock.virtualTimeMs = 0;
    this.ctx.clock.lastSourceTimeMs = 0;
    this.diagnosticsLog.length = 0;
  }

  setSpeed(speed: number): void {
    this.ctx.clock.speed = speed;
  }

  private async drive(): Promise<void> {
    // Initialize before the loop so the first tick does not lurch.
    this.ctx.clock.lastSourceTimeMs = this.deps.clockSource.nowMs();
    try {
      while (this.isRunning) {
        advanceClock(this.ctx, this.deps.clockSource.nowMs());
        const result = this.generator!.next();
        if (result.done) break;
        const yielded = result.value;
        if (yielded.type === 'waitUntilTime') {
          await this.waitUntilVirtualTime(yielded.targetTimeMs);
        } else {
          await this.deps.frameScheduler.nextFrame();
        }
      }
    } catch (error) {
      this.ctx.diagnostics.report({
        id: 'runtime-error',
        severity: 'error',
        title: 'Your program stopped with an error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Delay waits while the same unified clock advances — no manual time jump. */
  private async waitUntilVirtualTime(targetTimeMs: number): Promise<void> {
    while (this.isRunning && this.ctx.clock.virtualTimeMs < targetTimeMs) {
      await this.deps.frameScheduler.nextFrame();
      if (!this.isRunning) return;
      advanceClock(this.ctx, this.deps.clockSource.nowMs());
    }
  }
}
