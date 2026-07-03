/**
 * Runtime tests 1–16 (implemenation_plam/testing.md §2) — the Phase-0 gate.
 * All headless: SyntheticClockSource + SyntheticFrameScheduler, no DOM,
 * no requestAnimationFrame, no wall clock.
 */
import { describe, expect, it } from 'vitest';
import {
  blinkProgram,
  blinkWithoutDelayProgram,
  servoSweepProgram,
} from '../testing/fixtures';
import { runHeadless } from '../testing/synthetic';
import {
  bool,
  change,
  delayMs,
  digitalWrite,
  global,
  millis,
  pinModeStmt,
  program,
  readDigital,
  serialPrintln,
  servoAttach,
  servoWrite,
  variable,
  whileLoop,
  call,
} from '../testing/builders';
import { advanceClock } from './scheduler';
import { SeededRandom } from './seededRandom';
import { SerialBuffer } from './serialBuffer';
import type { RuntimeContext } from './types';

const digitalEvents = (run: Awaited<ReturnType<typeof runHeadless>>, pin: string) =>
  run.pinEvents.filter((event) => event.pin === pin && event.kind === 'digital');

describe('runtime (Phase-0 gate)', () => {
  it('1. blink toggles the LED pin', async () => {
    const run = await runHeadless(blinkProgram, { maxFrames: 400 });
    const d13 = digitalEvents(run, 'D13');
    expect(d13.length).toBeGreaterThanOrEqual(4);
    expect(d13.slice(0, 4).map((e) => e.value)).toEqual([true, false, true, false]);
    // Each loop() pass ends with a cooperative back-edge yield (runtime.md §4),
    // which consumes one 5ms frame — hence 1005/1505, not 1000/1500.
    expect(d13.slice(0, 4).map((e) => e.timeMs)).toEqual([0, 500, 1005, 1505]);
  });

  it('2. button press changes the input expression', async () => {
    const followButton = program({
      setup: [pinModeStmt('D2', 'INPUT_PULLUP')],
      loop: [digitalWrite('D13', readDigital('D2')), delayMs(20)],
    });
    const run = await runHeadless(followButton, {
      maxFrames: 60,
      onFrame: (frame, { scheduler }) => {
        if (frame === 10) scheduler.ctx.pins.setExternalDigital('D2', false); // press
        if (frame === 30) scheduler.ctx.pins.setExternalDigital('D2', undefined); // release
      },
    });
    const d13 = digitalEvents(run, 'D13');
    // Pull-up: unpressed reads HIGH, press drives LOW, release returns HIGH.
    expect(d13.map((e) => e.value)).toEqual([true, false, true]);
    expect(d13[1].timeMs).toBeGreaterThanOrEqual(50);
    expect(d13[2].timeMs).toBeGreaterThanOrEqual(150);
  });

  it('3. tight while(true) does not freeze', async () => {
    const tightLoop = program({ loop: [whileLoop(bool(true), [])] });
    const run = await runHeadless(tightLoop, { maxFrames: 100, budgetPerTick: 50 });
    // If the loop did not yield cooperatively this await would never resolve.
    expect(run.framesDelivered).toBeGreaterThanOrEqual(100);
    expect(run.finalVirtualTimeMs).toBe(500);
    expect(run.scheduler.running).toBe(false);
  });

  it('4. wait until button pressed resumes after an input change', async () => {
    const waitUntilPressed = program({
      setup: [pinModeStmt('D2', 'INPUT_PULLUP')],
      loop: [
        whileLoop(readDigital('D2'), []), // spins while unpressed (reads HIGH)
        digitalWrite('D13', true),
        delayMs(1000),
      ],
    });
    const run = await runHeadless(waitUntilPressed, {
      maxFrames: 200,
      budgetPerTick: 10,
      onFrame: (frame, { scheduler }) => {
        if (frame === 20) scheduler.ctx.pins.setExternalDigital('D2', false);
      },
    });
    const d13 = digitalEvents(run, 'D13');
    expect(d13.length).toBeGreaterThanOrEqual(1);
    expect(d13[0].value).toBe(true);
    expect(d13[0].timeMs).toBeGreaterThanOrEqual(100); // resumed only after the press
  });

  it('5. variables persist across loop iterations', async () => {
    const counter = program({
      globals: [global('count', 'number')],
      loop: [change('count', 1), serialPrintln(variable('count')), delayMs(100)],
    });
    const run = await runHeadless(counter, { maxFrames: 100 });
    expect(run.serialLines.slice(0, 5)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('6. millis() follows the unified virtual clock', async () => {
    const clockPrinter = program({ loop: [serialPrintln(millis()), delayMs(50)] });
    const run = await runHeadless(clockPrinter, { maxFrames: 40 });
    // 50ms delay + one 5ms cooperative back-edge frame per loop() pass.
    expect(run.serialLines.slice(0, 4)).toEqual(['0', '55', '110', '165']);
  });

  it('7. blink-without-delay toggles within a bounded virtual time', async () => {
    const run = await runHeadless(blinkWithoutDelayProgram, { maxFrames: 400 });
    const d13 = digitalEvents(run, 'D13');
    // No delay() anywhere — the LED still toggles because virtual time
    // advances on every cooperative tick. This is the clock litmus test.
    expect(d13.length).toBeGreaterThanOrEqual(3);
    expect(d13.slice(0, 3).map((e) => e.value)).toEqual([true, false, true]);
    expect(d13.slice(0, 3).map((e) => e.timeMs)).toEqual([500, 1000, 1500]);
  });

  it('8. a no-delay loop() observes time passing', async () => {
    const noDelay = program({ loop: [serialPrintln(millis())] });
    const run = await runHeadless(noDelay, { maxFrames: 10 });
    const times = run.serialLines.map(Number);
    expect(times[0]).toBe(0);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('9. delay resumes when the clock reaches the target, not by jumping time', async () => {
    // 123ms is not a multiple of the 5ms step: resume happens at the first
    // tick at/after the target (125, not 123), proving time is never jumped
    // to the target. The second pass starts one back-edge frame after the
    // 250ms resume (255), and its delay lands at 380.
    const oddBlink = program({
      loop: [digitalWrite('D13', true), delayMs(123), digitalWrite('D13', false), delayMs(123)],
    });
    const run = await runHeadless(oddBlink, { maxFrames: 100 });
    const d13 = digitalEvents(run, 'D13');
    expect(d13.slice(0, 4).map((e) => e.timeMs)).toEqual([0, 125, 255, 380]);
  });

  it('10. the scheduler runs headless in Node using injected clock/frame deps', async () => {
    expect(typeof window).toBe('undefined');
    expect(typeof requestAnimationFrame).toBe('undefined');
    const run = await runHeadless(blinkProgram, { maxFrames: 150 });
    expect(digitalEvents(run, 'D13').length).toBeGreaterThan(0);
  });

  it('11. synthetic fixed-step time produces the same trace across repeated runs', async () => {
    const randomized = program({
      loop: [serialPrintln(call('random', 0, 100)), digitalWrite('D13', readDigital('D2')), delayMs(30)],
    });
    const first = await runHeadless(randomized, { maxFrames: 200, seed: 7 });
    const second = await runHeadless(randomized, { maxFrames: 200, seed: 7 });
    expect(second.serialLines).toEqual(first.serialLines);
    expect(second.pinEvents).toEqual(first.pinEvents);
    expect(second.finalVirtualTimeMs).toBe(first.finalVirtualTimeMs);
  });

  it('12. browser elapsed time is clamped after long pauses', () => {
    const ctx = {
      clock: { virtualTimeMs: 0, lastSourceTimeMs: 0, speed: 1, maxElapsedMsPerTick: 100 },
    } as RuntimeContext;
    advanceClock(ctx, 10_000); // a 10s pause (backgrounded tab)
    expect(ctx.clock.virtualTimeMs).toBe(100); // clamped to one tick's worth
    expect(ctx.clock.lastSourceTimeMs).toBe(10_000); // the excess is discarded
    advanceClock(ctx, 10_016);
    expect(ctx.clock.virtualTimeMs).toBe(116);
    advanceClock(ctx, 9_000); // source time going backwards never rewinds
    expect(ctx.clock.virtualTimeMs).toBe(116);
  });

  it('13. random is deterministic with a seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const seqA = Array.from({ length: 10 }, () => a.nextInt(0, 1000));
    const seqB = Array.from({ length: 10 }, () => b.nextInt(0, 1000));
    expect(seqA).toEqual(seqB);
    const c = new SeededRandom(43);
    const seqC = Array.from({ length: 10 }, () => c.nextInt(0, 1000));
    expect(seqC).not.toEqual(seqA);
  });

  it('14. forRange supports servo sweep', async () => {
    const run = await runHeadless(servoSweepProgram, { maxFrames: 60 });
    const servo = run.pinEvents.filter((e) => e.pin === 'D9' && e.kind === 'servo');
    expect(servo.slice(0, 5).map((e) => e.value)).toEqual([0, 45, 90, 135, 180]);

    // Angles clamp to the physical 0–180 range.
    const overdrive = program({
      setup: [servoAttach('s', 'D9')],
      loop: [servoWrite('s', 999), delayMs(50)],
    });
    const clamped = await runHeadless(overdrive, { maxFrames: 20 });
    const clampedEvents = clamped.pinEvents.filter((e) => e.kind === 'servo');
    expect(clampedEvents[0].value).toBe(180);
  });

  it('15. stop cancels the scheduler', async () => {
    const run = await runHeadless(blinkProgram, {
      maxFrames: 400,
      onFrame: (frame, { scheduler }) => {
        if (frame === 50) scheduler.stop();
      },
    });
    expect(run.scheduler.running).toBe(false);
    // Stop lands mid-wait; the final partial frame's time is discarded, so
    // the clock halts at or just under the stop frame (245–250 here).
    expect(run.finalVirtualTimeMs).toBeGreaterThan(200);
    expect(run.finalVirtualTimeMs).toBeLessThanOrEqual(250);
    for (const event of run.pinEvents) {
      expect(event.timeMs).toBeLessThanOrEqual(250);
    }
  });

  it('16. reset clears state', async () => {
    const counter = program({
      globals: [global('count', 'number')],
      loop: [change('count', 1), serialPrintln(variable('count')), digitalWrite('D13', true), delayMs(100)],
    });
    const run = await runHeadless(counter, { maxFrames: 50 });
    expect(run.scheduler.ctx.globals.get('count')).toBeGreaterThan(0);

    run.scheduler.reset();
    expect(run.scheduler.ctx.globals.size).toBe(0);
    expect(run.scheduler.ctx.serial.lines()).toEqual([]);
    expect(run.scheduler.ctx.pins.get('D13')).toBeUndefined();
    expect(run.scheduler.ctx.clock.virtualTimeMs).toBe(0);
    expect(run.scheduler.diagnostics()).toEqual([]);
  });
});

describe('serial buffer', () => {
  it('is bounded and counts dropped lines', () => {
    const buffer = new SerialBuffer(500);
    for (let i = 0; i < 600; i++) buffer.println(String(i));
    expect(buffer.lines().length).toBe(500);
    expect(buffer.droppedLines()).toBe(100);
    expect(buffer.lines()[0]).toBe('100'); // oldest dropped first
  });
});
