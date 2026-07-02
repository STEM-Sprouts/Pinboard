# Pinboard — Build Tasks (ordered)

Do these top-to-bottom. Each task names the **governing doc** to open and an **exit test** that must pass before you move on. Check the box when the exit test is green. Do not reorder — Phase 0 proves the only remaining load-bearing assumption before anything else is built.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done. Governing doc in **bold**.

---

## Phase 0 — Week-1 runtime scheduler spike (headless, do this first)

Goal: prove the runtime clock/scheduler before any UI, Supabase, OAuth, or compiler work. Keep UI minimal or absent. No Supabase, no OAuth, no live compiler, no lesson framework.

- [x] **runtime.md** — Define runtime types: `ClockSource`, `FrameScheduler`, `RuntimeSchedulerDeps`, `RuntimeClock`, `RuntimeContext`. *Exit:* types compile; interpreter reads only `ctx.clock.virtualTimeMs`. → `src/runtime/types.ts`
- [x] **runtime.md** — Implement the generator interpreter (statements + expressions) and the unified-clock scheduler (`advanceClock`, `waitUntilVirtualTime`, `drive`) with the per-tick elapsed clamp. *Exit:* runtime tests 1–16 in testing.md pass headless in Node with a synthetic clock. → `src/runtime/{interpreter,expressions,scheduler}.ts`, tests in `src/runtime/runtime.test.ts` (25/25 green 2026-07-01)
- [x] **runtime.md** — Loop back-edge cooperative yielding (`while`, `repeat`, `forRange`, top-level `loop()`, `wait until`). *Exit:* tight `while(true)` does not freeze; runtime stays responsive under the tight-loop test. → runtime tests 3, 4
- [x] **codegen.md** — Minimal IR types + a hand-built IR (or fixture loader) for LED and Button. *Exit:* `blink`, `blink-without-delay`, `button-controls-led` fixtures exist as IR. → `src/ir/types.ts`, `src/testing/fixtures.ts` (+ servo-sweep)
- [x] **codegen.md** — IR → Arduino C printer (enough for the three fixtures) + `pinMode` inference. *Exit:* printed C for the three fixtures matches expected and is deterministic. → `src/arduino/{printArduino,pinModeInference}.ts`, golden tests in `src/arduino/printArduino.test.ts`
- [x] **testing.md** — Headless fixtures with `SyntheticClockSource` + `SyntheticFrameScheduler`. *Exit:* **`blink` toggles; `blink-without-delay` toggles because virtual time advances every tick; `button-controls-led` resumes after input; traces are identical across repeated runs.** This is the Phase-0 gate. → `src/testing/synthetic.ts`; gate green 2026-07-01 (`npm test`)

Phase-0 exit criteria (all must hold): Blink works · Blink Without Delay works · Button Controls LED works · tight loop does not freeze · variables persist across `loop()` · `millis()` advances without `delay()` · `delay()`/`millis()` share one clock · runs headless in Node · deterministic traces · long browser pauses are clamped · code printed from IR matches runtime behavior.

---

## Phase 1 — Learning loop MVP (still no account)

- [x] **hardware.md** — Arduino Uno `BoardProfile` (audited pins D0–D13, A0–A5, PWM, serial-reserved, timer notes). *Exit:* pin-validation unit tests pass; board drives the pin picker. → profile + diagnostics tests done (`src/hardware/`); board-aware `PinPicker` UI drives pin selection (2026-07-02, commit 3f20145)
- [x] **hardware.md** — Dynamic component panel + LED, Button, Potentiometer (rule of three). *Exit:* a component can be added, assigned a pin, and appears in the simulator. → `src/hardware/components.ts`, dynamic `SimulationPanel` (2026-07-02)
- [x] **hardware.md** — Board-aware pin picker + pin/wiring diagnostics (conflict, capability mismatch, block-writes-unconnected-pin, D0/D1 warning). *Exit:* required-diagnostics table cases fire with correct severity and are visible in the panel. → `PinPicker` + `analyzeComponentDiagnostics` (pin conflict error, unconnected-component error, write-without-component warning), all panel-visible (2026-07-02)
- [~] **codegen.md** — Full beginner/intermediate block library + Blocks→IR lowering (LED `activeHigh`, button `pullMode`, potentiometer map, variables-as-globals, library hoisting). *Exit:* lowering unit tests pass; active-high and active-low LEDs emit opposite writes. → component blocks (`led_set`, `button_is_pressed`, `pot_read`) lower through instance config; active-high/low opposite-write test green (2026-07-02); variables/logic/math/time blocks done (2026-07-02, commit d7f3460); pending: constrain/min/max/abs, forRange, PWM-write block, comment block, LED brightness/blink + button wait-until-pressed + pot map/threshold component blocks, library hoisting (Servo.h — Phase 3)
- [x] **codegen.md** — CodeMirror 6 **read-only** preview wired to IR-printed C. *Exit:* preview updates on block change; typing does nothing. → CodeMirror 6 with C++ highlighting + line numbers, one-way enforced by E2E (2026-07-02, commit 889bd77); line↔block `CodeSourceMap` (codegen.md §9, acceptance §11) still pending
- [x] **runtime.md** — Browser wiring of the scheduler (`performance.now()` + `requestAnimationFrame`) + Run/Stop/Reset + serial monitor + component views. *Exit:* runtime acceptance (ARCHITECTURE §11) holds in the browser. → `src/runtime/browserDeps.ts`, App runs IR; mock-hex emulator removed (2026-07-02)
- [x] **persistence.md** — `PinboardProjectDocument`, LocalStorage autosave (debounced), reload restore, failure handling. *Exit:* modify → reload → project restored with no account; simulated storage failure warns and does not discard work. → `src/persistence/` (2026-07-02)
- [x] **persistence.md** — `.pinboard.json` import/export + Zod validation + `migrateProject`. *Exit:* round-trip matches; malformed import fails safely. → tests in `src/persistence/persistence.test.ts` + E2E import/export (2026-07-02)
- [x] **lessons.md** — Two lessons in plain text, then a minimal lesson panel + checks for Blink and Button. *Exit:* a beginner completes both with no account. → lesson drawer + checks against project doc / IR / headless runtime trace (never code text); progress persists into the project document (2026-07-02, commit 62a4f3b)
- [~] **testing.md** — Vitest unit suite + the one Playwright learning-loop flow. *Exit:* both green in CI. → Vitest 71 tests + Playwright 20 E2E (incl. button-controls-LED learning loop, lesson checks, read-only preview) all green locally 2026-07-02; ci.yml runs typecheck+lint+Vitest only — **Playwright job missing from CI**, so the "both green in CI" exit is not yet met
- [x] **compiler.md** — CI arduino-cli compile job over fixtures. *Exit:* all canonical fixtures compile; deterministic printer asserted. → `.github/workflows/arduino-compile.yml` + `npm run generate:arduino-fixtures` (2026-07-02)

Phase-1 exit: a beginner completes Blink and Button with no account · reload does not lose work · generated C compiles in CI.

---

## Phase 2 — Cloud save (optional path)

- [ ] **supabase.md** — Supabase project, `profiles`/`projects` tables, RLS policies. *Exit:* RLS tests pass (user A cannot read user B's project).
- [ ] **supabase.md** — Google OAuth + magic-link fallback + `/auth/callback` route. *Exit:* sign-in works; **OAuth failure does not block local use.**
- [ ] **persistence.md + supabase.md** — Cloud save, local→cloud promotion, cloud→local fallback, conflict UI, project hash excluding volatile fields. *Exit:* signed-in save/load works; failed cloud write never overwrites local; hash dedup skips no-op writes.
- [ ] **supabase.md** — Project list + basic account settings. *Exit:* projects appear after reload.

Phase-2 exit: signed-in user can save/load cloud projects · OAuth failure does not block local use · RLS tests pass.

---

## Phase 3 — Expanded hardware & codegen

- [ ] **hardware.md** — Buzzer, Servo (RGB LED optional). *Exit:* components simulate; servo range clamps 0–180.
- [ ] **codegen.md** — More math blocks, `forRange`, `millis()` lesson support, library hoisting for `Servo.h`, timer-conflict warnings. *Exit:* servo/buzzer sketches compile in CI; timer-conflict warnings appear on D9/D10 (servo) and D3/D11 (tone).
- [ ] **hardware.md** — Better diagnostics + quick fixes. *Exit:* pin-mismatch quick fixes work for LED/Button.

Phase-3 exit: servo and buzzer sketches compile in CI · timer conflict warnings appear · generated code stays beginner-readable.

---

## Phase 4 — Compiler backend beta (feature-gated)

- [ ] **compiler.md** — External compile worker; server lowers project doc → IR → C itself; compile cache; feature flag. *Exit:* **the endpoint cannot compile an arbitrary client string**; timeout/limits enforced.
- [ ] **compiler.md** — CodeMirror error-line highlighting from compiler diagnostics. *Exit:* a compile error highlights the right line; if the compiler fails, the simulator still works.

Phase-4 exit: compiler cannot compile arbitrary client string · timeout and limits enforced · simulator works if compiler is down.

---

## Phase 5 — Sharing

- [ ] **supabase.md** — Unlisted, expiring, revocable share links via `get_shared_project` RPC; remix after sign-in/anonymous session. *Exit:* share links are revocable and expiring; view-only never exposes the private project list; no public gallery.

Phase-5 exit: share links are revocable and expiring · view-only does not leak the owner's project list.

---

## Cross-cutting (keep green throughout)

- [ ] **testing.md** — Fitness functions in CI: bundle budget, editor load-time budget, tight-loop responsiveness, arduino-cli compile, malformed-import tests, RLS tests, basic axe a11y.
- [ ] **testing.md** — Differential test stretch goal: interpreter trace vs compiled-HEX-in-avr8js trace for selected fixtures.
