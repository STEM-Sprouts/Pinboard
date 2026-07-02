# Domain: Testing (unit, runtime, E2E, fitness functions)

Divides cleanly across three layers: **Vitest** (unit + runtime, deterministic, headless), **Playwright** (one E2E learning-loop flow), and **CI fitness functions** (automated gates). Compile correctness lives in `compiler.md` (arduino-cli). Do not duplicate across layers.

## 1. Unit tests (Vitest)

Cover: Blockly lowering · IR validation · C printer · `pinMode` inference · diagnostics · project migration · localStorage adapter · Supabase adapter mocks · runtime expression evaluation · **project-hash normalization excluding volatile fields** · **editor-mode toolbox filtering without workspace mutation** · **active-high and active-low LED lowering**.

Codegen tests: prefer **structural/AST assertions** ("pin 13 gets `pinMode(OUTPUT)` + `digitalWrite(HIGH)`") over exact-string matching. Keep a small number of **golden-file** snapshots for canonical lessons only, and stabilize printer output with a fixed formatter so snapshots don't churn.

## 2. Runtime tests (Vitest, headless, deterministic)

Run the interpreter with `SyntheticClockSource` + `SyntheticFrameScheduler` — no DOM, no `requestAnimationFrame`, no wall-clock. Required cases:

1. Blink toggles the LED pin.
2. Button press changes the input expression.
3. Tight `while(true)` does not freeze.
4. `wait until button pressed` resumes after an input change.
5. Variables persist across loop iterations.
6. `millis()` follows the unified virtual clock.
7. **`blink-without-delay` toggles the LED within a bounded virtual time.**
8. A no-delay `loop()` observes time passing.
9. `delay(ms)` resumes when the clock reaches the target, not by jumping time.
10. The scheduler runs headless in Node using injected clock/frame deps.
11. Synthetic fixed-step time produces the **same** pin/serial trace across repeated runs.
12. Browser elapsed time is clamped after long pauses.
13. Random is deterministic with a seed.
14. `forRange` supports servo sweep.
15. Stop cancels the scheduler.
16. Reset clears state.
17. Active-high and active-low LED configs produce opposite on/off electrical writes.
18. Editor mode filters toolbox options but does not mutate loaded workspace data.

Cases 1–16 (plus the Phase-0 fixtures) are the **week-1 spike gate** — see `TASKS.md` Phase 0 and `runtime.md`.

## 3. Fixtures (shared with compiler.md)

Canonical `.pinboard.json` fixtures are authored once and reused by runtime tests, the CI compile job, and Playwright: `blink-led`, `button-controls-led`, `potentiometer-brightness`, `buzzer-alarm`, `servo-sweep`, `blink-without-delay`. Each may also carry an expected IR fixture and a formatted `.ino` golden file.

## 4. Playwright E2E (one core flow)

Minimum path — assert on observable state, never `waitForTimeout`; seed known state via the project-load/import path rather than dragging Blockly SVG:

```txt
Open editor → Select Arduino Uno → Add LED → Pin D13 → Add Blink blocks →
Run → Verify LED changes → Verify code preview contains digitalWrite(13, HIGH) →
Save locally → Reload → Project still exists
```

Cloud E2E is a separate, later, tagged suite (`@cloud`, skipped by default; do not hit real Supabase in the core suite):

```txt
Sign in (test account) → Create project → Save to Supabase → Reload → Project appears in list
```

(For the full E2E prompt with the Blockly-seeding and clock-determinism rules, see the companion Playwright test prompt.)

## 5. Fitness functions (CI gates)

| Fitness function | Gate |
|---|---|
| Bundle budget | Warn/fail above target (Chromebook-first) |
| Editor load time | Playwright/Lighthouse budget on a throttled profile |
| Runtime responsiveness | tight-loop test does not exceed frame budget |
| Generated C compiles | arduino-cli compile job (compiler.md) |
| Project import validation | malformed-import tests fail safely |
| RLS policy tests | Supabase local test: user A cannot read user B |
| Accessibility | basic axe checks on key screens |

## 6. Differential test (stretch)

For selected fixtures, compare the interpreter's pin/serial trace against the trace from compiling the generated C and running the HEX in avr8js. This proves the simulator matches the code and is only possible because CI compile exists. Not launch-blocking.

## 7. Performance budgets (source of the gates)

Chromebook-first: initial load under ~3s on a throttled profile; no noticeable lag under ~100 blocks; simulator start under ~500ms; code preview debounced (~250ms); bounded serial memory. Lazy-load Blockly, CodeMirror, lesson content, and charting; do not load everything on the board-selection screen.

---

**Cross-refs:** runtime types/scheduler → `runtime.md`. Codegen determinism → `codegen.md`. Compile job → `compiler.md`. RLS → `supabase.md`. Import validation → `persistence.md`.
