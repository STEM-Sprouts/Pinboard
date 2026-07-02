# ADR-0005 — One unified, injected virtual clock

**Status:** Accepted

## Context

If `delay()` and `millis()` read different time sources, `blink-without-delay` style programs behave differently in the simulator than on hardware, and tests become wall-clock-dependent and flaky.

## Decision

The runtime has a single virtual clock (`docs/domains/runtime.md`): `millis()` reads it; `delay(ms)` waits until the clock reaches a target. It advances from an **injected** `ClockSource` × simulation speed, with the per-tick elapsed time clamped (long browser pauses don't teleport time). The interpreter reads time only from `ctx.clock.virtualTimeMs`; only the scheduler touches the injected source. No `Date.now()`, `performance.now()`, `Math.random()`, or `requestAnimationFrame` inside interpreter, printer, or lowering; `random()` uses the seeded RNG.

## Consequences

- The runtime runs headless in Node with `SyntheticClockSource`/`SyntheticFrameScheduler`; traces are deterministic across runs.
- No-delay `loop()` programs still observe time passing.
- Browser wiring injects `performance.now` + `requestAnimationFrame` at the edge only (`src/runtime/browserDeps.ts`).
