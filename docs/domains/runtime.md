# Domain: Runtime (simulator, scheduler, clock)

Owns the canonical runtime types: **`ClockSource`, `FrameScheduler`, `RuntimeSchedulerDeps`, `RuntimeClock`, `RuntimeContext`**. Executes the IR (defined in `codegen.md`). Governs ADR-0005. This is the Phase-0 subject — build and prove it before any UI.

## 1. Why an IR interpreter

avr8js and a live compiler are heavier and less controllable. The IR interpreter gives a fast teaching simulator with clear diagnostics and full control over timing. It executes the same IR the C printer prints from, so behavior and code cannot drift (ADR-0003).

```txt
ProgramIR → RuntimeContext → generator interpreter → scheduler → virtual clock
          → pin state store → component simulator views → serial monitor
```

## 2. Injectable clock & frame dependencies (the load-bearing seam)

The interpreter must run in the browser **and** headless in Node with deterministic timing. The clock and frame source are dependency-injected. The interpreter never asks the browser for time — it only reads `ctx.clock.virtualTimeMs`. The scheduler is the only layer allowed to consult `ClockSource` and update virtual time.

```ts
type ClockSource = {
  nowMs(): number;
};

type FrameScheduler = {
  nextFrame(): Promise<void>;
};

type RuntimeSchedulerDeps = {
  clockSource: ClockSource;
  frameScheduler: FrameScheduler;
};

type RuntimeClock = {
  virtualTimeMs: number;
  lastSourceTimeMs: number;
  speed: number;
  maxElapsedMsPerTick: number;   // clamp so a backgrounded tab does not jump time
};

type RuntimeContext = {
  board: BoardProfile;            // hardware.md
  pins: PinStateStore;
  serial: SerialBuffer;
  globals: Map<string, RuntimeValue>;
  clock: RuntimeClock;
  rng: SeededRandom;
  budgetPerTick: number;
  diagnostics: DiagnosticSink;
};
```

Browser wiring:

```ts
const deps: RuntimeSchedulerDeps = {
  clockSource: { nowMs: () => performance.now() },
  frameScheduler: {
    nextFrame: () => new Promise(resolve => requestAnimationFrame(() => resolve())),
  },
};
```

Headless test wiring (deterministic):

```ts
const clock = new SyntheticClockSource();
const deps: RuntimeSchedulerDeps = {
  clockSource: clock,
  frameScheduler: new SyntheticFrameScheduler(clock, 5), // advance 5 virtual ms per frame
};
```

| Environment | Clock source | Frame scheduler | Why |
|---|---|---|---|
| Browser | `performance.now()` | `requestAnimationFrame` | Smooth UI, native pacing |
| Node runtime spike | synthetic fixed-step | synthetic fixed-step | Deterministic headless fixtures |
| CI trace tests | synthetic fixed-step | synthetic fixed-step | Reproducible pin/serial traces |
| Future visual slow mode | browser clock | rAF + speed multiplier | Same semantics, different source |

## 3. The generator interpreter

The interpreter is a JS generator. It yields control instead of blocking.

```ts
function* executeStatements(statements: StatementIR[], ctx: RuntimeContext): Generator<RuntimeYield> {
  for (const stmt of statements) {
    yield* executeStatement(stmt, ctx);
  }
}
```

`delay` yields a target time; it never increments the clock itself (the scheduler owns the clock, preventing double-counting):

```ts
case 'delay': {
  const ms = evaluate(stmt.ms, ctx);
  const targetTimeMs = ctx.clock.virtualTimeMs + ms;
  yield { type: 'waitUntilTime', targetTimeMs };
  return;
}
```

## 4. Loop back-edge yielding (tight loops must never freeze the tab)

```ts
function* executeWhile(stmt: WhileIR, ctx: RuntimeContext) {
  let iterations = 0;
  while (truthy(evaluate(stmt.condition, ctx))) {
    yield* executeStatements(stmt.body, ctx);
    iterations++;
    if (iterations >= ctx.budgetPerTick) {
      iterations = 0;
      yield { type: 'cooperative' };
    }
  }
}
```

Also yield on: each top-level `loop()` pass · each `repeat` iteration after budget · each `forRange` iteration after budget · `wait until condition`.

## 5. Scheduler & the unified clock

```ts
class RuntimeScheduler {
  constructor(private deps: RuntimeSchedulerDeps) {}
  run(program: ProgramIR) {}
  stop() {}
  reset() {}
  setSpeed(speed: number) {}
}
```

Rules:

1. The scheduler owns one unified virtual clock.
2. It receives `ClockSource` + `FrameScheduler`; it never directly calls `performance.now()` or `requestAnimationFrame`.
3. On every resume/tick, advance virtual time from injected clock progress, clamped:

```ts
function advanceClock(ctx: RuntimeContext, nowSourceMs: number) {
  const rawElapsedMs = Math.max(0, nowSourceMs - ctx.clock.lastSourceTimeMs);
  const elapsedMs = Math.min(rawElapsedMs, ctx.clock.maxElapsedMsPerTick);
  ctx.clock.virtualTimeMs += elapsedMs * ctx.clock.speed;
  ctx.clock.lastSourceTimeMs = nowSourceMs;
}
```

4. `millis()` returns `ctx.clock.virtualTimeMs`.
5. `delay(ms)` yields `waitUntilTime` and resumes only when the unified clock reaches the target — no manual time jump.
6. `cooperative` yields resume on the injected frame scheduler, but time still advances because `advanceClock()` is called before resuming.
7. Stop discards the generator and cancels pending waits.
8. Reset clears pins, serial, globals, RNG (if seeded), and the clock.

Delay handling waits while the same clock advances:

```ts
async function waitUntilVirtualTime(runtime: RuntimeInstance, targetTimeMs: number) {
  while (runtime.running && runtime.ctx.clock.virtualTimeMs < targetTimeMs) {
    await runtime.deps.frameScheduler.nextFrame();
    advanceClock(runtime.ctx, runtime.deps.clockSource.nowMs());
  }
}
```

Main drive loop (initializes `lastSourceTimeMs` before the loop so the first tick does not lurch):

```ts
async function drive(runtime: RuntimeInstance) {
  runtime.ctx.clock.lastSourceTimeMs = runtime.deps.clockSource.nowMs();
  while (runtime.running) {
    advanceClock(runtime.ctx, runtime.deps.clockSource.nowMs());
    const result = runtime.generator.next();
    if (result.done) {
      runtime.restartLoopIfNeeded();
      await runtime.deps.frameScheduler.nextFrame();
      continue;
    }
    const y = result.value;
    if (y.type === 'waitUntilTime') { await waitUntilVirtualTime(runtime, y.targetTimeMs); continue; }
    if (y.type === 'cooperative')   { await runtime.deps.frameScheduler.nextFrame(); continue; }
  }
}
```

## 6. Required clock behavior for Blink Without Delay (a first-class runtime test)

```txt
loop pass 1: millis() reads 0 → condition false → cooperative yield
scheduler tick: injected clock advances → virtualTimeMs increases
later loop pass: millis() reads >= 500 → condition true → LED toggles → lastToggle updates
```

If the LED never toggles, the runtime clock is wrong even if the generated C compiles. Compile tests prove the printed C is syntactically real; they do **not** prove the simulator's clock semantics. See `testing.md` for the fixture assertion.

## 7. Infinite-loop detection

A tight `while(true)` must not crash the browser. It keeps running cooperatively; if there are no observable changes for a long time, surface an info/warning: "Your program is running a loop that never ends. This is allowed on Arduino, but it may prevent later blocks from running."

## 8. Delay honesty, millis, random

- **Delay is honest.** `delay(1000)` blocks the program; a button press during a delay may be missed. Teach this ("that's why `millis()` exists"), do not fake responsiveness. (Lesson copy lives in `lessons.md`.)
- **`millis()`** reads the unified virtual clock, never wall time — so slow/fast mode stay consistent.
- **`random()`** uses a seeded RNG (`SeededRandom`) so traces are deterministic; do not emit `randomSeed(analogRead(...))` by default (it conflicts with real analog use). See `codegen.md` §random.

## 9. Pin state store & component simulation

```ts
type PinState = {
  mode?: 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT';
  digitalValue?: boolean;
  analogValue?: number;
  pwmValue?: number;
  lastUpdatedAtMs: number;
  writers: string[];
};
```

Components subscribe to pin state:

- **LED** — digital HIGH → on, LOW → off, PWM 0–255 → brightness (respect `activeHigh`).
- **Button** — UI pressed/released changes the input read value based on pull mode.
- **Potentiometer** — slider 0–1023 → `analogRead(pin)`.
- **Servo** — `servo.write(angle)` → arm rotates to angle (clamp 0–180).
- **Buzzer** — `tone(pin, hz)` → visual waveform. Do **not** auto-play sound (browsers block audio; classrooms get noisy).

Input is applied between resumes, so the interpreter must re-read pins on each evaluation (never cache a read) — this is what makes `wait until button pressed` work.

## 10. Runtime budget & serial buffer

- Throttle UI updates; do not re-render the whole workspace on every pin change.
- Serial buffer is bounded (ring buffer, cap ~500 lines); drop oldest and show a "older output hidden" note.

## 11. Tests

See `testing.md` §runtime tests (cases 1–18) and the Phase-0 gate in `TASKS.md`.

---

**Cross-refs:** IR/expression/statement types → `codegen.md`. `BoardProfile`/`PinId` → `hardware.md`. Fixtures & assertions → `testing.md`.
