/**
 * Deterministic headless wiring (implemenation_plam/runtime.md §2,
 * testing.md §2): a synthetic fixed-step clock + frame scheduler so runtime
 * fixtures run in Node with reproducible pin/serial traces — no DOM, no
 * `requestAnimationFrame`, no wall clock.
 */
import { arduinoUno } from '../hardware/boards/arduinoUno';
import type { BoardProfile, Diagnostic } from '../hardware/types';
import type { ProgramIR } from '../ir/types';
import type { PinChangeEvent } from '../runtime/pinState';
import { RuntimeScheduler } from '../runtime/scheduler';
import type { ClockSource, FrameScheduler } from '../runtime/types';

export class SyntheticClockSource implements ClockSource {
  private timeMs = 0;

  nowMs(): number {
    return this.timeMs;
  }

  advance(ms: number): void {
    this.timeMs += ms;
  }
}

export type SyntheticFrameOptions = {
  maxFrames?: number;
  onFrameLimit?: () => void;
  /** Called after the clock advances for the frame — inject inputs here. */
  onFrame?: (frame: number) => void;
};

export class SyntheticFrameScheduler implements FrameScheduler {
  framesDelivered = 0;
  private clock: SyntheticClockSource;
  private stepMs: number;
  private options: SyntheticFrameOptions;

  constructor(clock: SyntheticClockSource, stepMs: number, options: SyntheticFrameOptions = {}) {
    this.clock = clock;
    this.stepMs = stepMs;
    this.options = options;
  }

  async nextFrame(): Promise<void> {
    this.framesDelivered++;
    if (this.options.maxFrames !== undefined && this.framesDelivered > this.options.maxFrames) {
      // The frame budget is exhausted; the owner must stop the runtime or
      // the drive loop would spin on microtasks forever.
      this.options.onFrameLimit?.();
      return;
    }
    this.clock.advance(this.stepMs);
    this.options.onFrame?.(this.framesDelivered);
    await Promise.resolve();
  }
}

export type HeadlessRunOptions = {
  /** Virtual ms added per frame (default 5, as in runtime.md §2). */
  stepMs?: number;
  /** Hard stop after this many frames (default 4000 → 20s of virtual time). */
  maxFrames?: number;
  seed?: number;
  speed?: number;
  budgetPerTick?: number;
  maxElapsedMsPerTick?: number;
  board?: BoardProfile;
  /** Runs after each frame's clock step — press buttons, stop the run, etc. */
  onFrame?: (frame: number, api: HeadlessApi) => void;
};

export type HeadlessApi = {
  scheduler: RuntimeScheduler;
  clock: SyntheticClockSource;
};

export type HeadlessRun = {
  scheduler: RuntimeScheduler;
  pinEvents: PinChangeEvent[];
  serialLines: string[];
  diagnostics: readonly Diagnostic[];
  framesDelivered: number;
  finalVirtualTimeMs: number;
};

/**
 * Runs a program to its frame budget (or until stopped from `onFrame`) and
 * returns the collected pin/serial trace. Same options → same trace, always.
 */
export async function runHeadless(program: ProgramIR, options: HeadlessRunOptions = {}): Promise<HeadlessRun> {
  const clock = new SyntheticClockSource();
  // Assigned once below; `let` only because the frame scheduler's callbacks
  // close over it before it can be constructed.
  // eslint-disable-next-line prefer-const
  let scheduler: RuntimeScheduler;
  const frameScheduler = new SyntheticFrameScheduler(clock, options.stepMs ?? 5, {
    maxFrames: options.maxFrames ?? 4000,
    onFrameLimit: () => scheduler.stop(),
    onFrame: (frame) => options.onFrame?.(frame, { scheduler, clock }),
  });
  scheduler = new RuntimeScheduler(
    { clockSource: clock, frameScheduler },
    {
      board: options.board ?? arduinoUno,
      seed: options.seed,
      speed: options.speed,
      budgetPerTick: options.budgetPerTick,
      maxElapsedMsPerTick: options.maxElapsedMsPerTick,
    },
  );

  const pinEvents: PinChangeEvent[] = [];
  scheduler.ctx.pins.onChange((event) => pinEvents.push({ ...event }));

  await scheduler.run(program);

  return {
    scheduler,
    pinEvents,
    serialLines: [...scheduler.ctx.serial.lines()],
    diagnostics: scheduler.diagnostics(),
    framesDelivered: frameScheduler.framesDelivered,
    finalVirtualTimeMs: scheduler.ctx.clock.virtualTimeMs,
  };
}
