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
- [x] **codegen.md** — Full beginner/intermediate block library + Blocks→IR lowering (LED `activeHigh`, button `pullMode`, potentiometer map, variables-as-globals, library hoisting). *Exit:* lowering unit tests pass; active-high and active-low LEDs emit opposite writes. → complete 2026-07-02: component blocks (`led_set/brightness/blink`, `button_is_pressed/wait`, `pot_read/map/above`) lower through instance config (active-high/low opposite writes tested; active-low brightness emits `255 - value`); variables/logic/math/time + constrain/min/max/abs, for_range (loop var excluded from globals), set_pwm, comment_note; printer hoists Servo.h/decl/attach (servo/buzzer *blocks* land with their components in Phase 3); editor-mode toolbox tiers via `buildToolbox` (persistence.md §2)
- [x] **codegen.md** — CodeMirror 6 **read-only** preview wired to IR-printed C. *Exit:* preview updates on block change; typing does nothing. → CodeMirror 6 with C++ highlighting + line numbers, one-way enforced by E2E (2026-07-02, commit 889bd77); line↔block `CodeSourceMap` done — printer emits the map, selecting a block highlights exactly its printed lines, unit + E2E tested (2026-07-02)
- [x] **runtime.md** — Browser wiring of the scheduler (`performance.now()` + `requestAnimationFrame`) + Run/Stop/Reset + serial monitor + component views. *Exit:* runtime acceptance (ARCHITECTURE §11) holds in the browser. → `src/runtime/browserDeps.ts`, App runs IR; mock-hex emulator removed (2026-07-02)
- [x] **persistence.md** — `PinboardProjectDocument`, LocalStorage autosave (debounced), reload restore, failure handling. *Exit:* modify → reload → project restored with no account; simulated storage failure warns and does not discard work. → `src/persistence/` (2026-07-02)
- [x] **persistence.md** — `.pinboard.json` import/export + Zod validation + `migrateProject`. *Exit:* round-trip matches; malformed import fails safely. → tests in `src/persistence/persistence.test.ts` + E2E import/export (2026-07-02)
- [x] **lessons.md** — Two lessons in plain text, then a minimal lesson panel + checks for Blink and Button. *Exit:* a beginner completes both with no account. → lesson drawer + checks against project doc / IR / headless runtime trace (never code text); progress persists into the project document (2026-07-02, commit 62a4f3b)
- [x] **testing.md** — Vitest unit suite + the one Playwright learning-loop flow. *Exit:* both green in CI. → Vitest 76 tests + Playwright 21 E2E (incl. button-controls-LED learning loop, lesson checks, read-only preview, source-map highlight) green; ci.yml runs a dedicated Playwright job (2026-07-02, commit 85ad946)
- [x] **compiler.md** — CI arduino-cli compile job over fixtures. *Exit:* all canonical fixtures compile; deterministic printer asserted. → `.github/workflows/arduino-compile.yml` + `npm run generate:arduino-fixtures` (2026-07-02)

Phase-1 exit: a beginner completes Blink and Button with no account · reload does not lose work · generated C compiles in CI. → **Phase 1 complete 2026-07-02**: four lessons (Blink, Change Blink Speed, Button, Pot Brightness), line↔block source map, editor modes, 90 unit + 22 E2E green, dead mock-emulator code removed.

---

## Phase 2 — Cloud save (optional path)

- [~] **supabase.md** — Supabase project, `profiles`/`projects` tables, RLS policies. *Exit:* RLS tests pass (user A cannot read user B's project). → schema + RLS + hashed-token `get_shared_project` RPC authored in `supabase/migrations/0001_init.sql` (2026-07-02); **blocked on creating the Supabase project (user step)**, then apply migrations + live RLS tests
- [~] **supabase.md** — Google OAuth + magic-link fallback + `/auth/callback` route. *Exit:* sign-in works; **OAuth failure does not block local use.** → auth wrappers (`src/supabase/auth.ts`), config-gated sign-in UI (hidden without env keys — E2E-asserted), `/auth/callback` session handling (2026-07-02); pending: real OAuth config + live sign-in test
- [~] **persistence.md + supabase.md** — Cloud save, local→cloud promotion, cloud→local fallback, conflict UI, project hash excluding volatile fields. *Exit:* signed-in save/load works; failed cloud write never overwrites local; hash dedup skips no-op writes. → normalized hash (`projectHash.ts`, volatile fields excluded, key-order-insensitive) + repository with hash dedup, non-throwing failures, Zod row validation, fake-port unit tests (2026-07-02); pending once creds exist: promotion ask, conflict UI, autosave wiring
- [~] **supabase.md** — Project list + basic account settings. *Exit:* projects appear after reload. → `/projects` lists local projects with open-by-id (2026-07-02); cloud rows + account settings pending creds

Phase-2 exit: signed-in user can save/load cloud projects · OAuth failure does not block local use · RLS tests pass.

---

## Phase 3 — Expanded hardware & codegen

- [x] **hardware.md** — Buzzer, Servo (RGB LED optional). *Exit:* components simulate; servo range clamps 0–180. → placeable Buzzer (D8 default, avoids D3/D11) + Servo (D9 default, digital pins allowed — no "needs PWM" error); panel renders live tone Hz + servo angle dial from runtime pin events; angle literals clamp 0–180 in lowering, runtime clamps at the pin store (2026-07-02)
- [x] **codegen.md** — More math blocks, `forRange`, `millis()` lesson support, library hoisting for `Servo.h`, timer-conflict warnings. *Exit:* servo/buzzer sketches compile in CI; timer-conflict warnings appear on D9/D10 (servo) and D3/D11 (tone). → buzzer_play/stop + servo_set_angle blocks lower through instances with one servoAttach inferred into setup(); printer hoists Servo.h/decl; timerNotes warnings pinned by unit tests; buzzer-alarm + servo-sweep sketches in the CI compile set (2026-07-02)
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
