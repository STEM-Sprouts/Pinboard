# Pinboard — Working Agreement (read this first, every session)

Pinboard is a **learning-first browser IDE for physical computing**. A beginner picks an Arduino Uno, adds virtual hardware components, programs them with Blockly blocks, sees readable Arduino C, and runs an IR-based teaching simulator — all client-side, local-first, no account required. Stack: **React + Vite + React Router + Blockly + CodeMirror 6 + Supabase (optional)**.

This is the always-loaded spine: *how we write code* and the *rules that must never drift*. It does not repeat the detailed specs — those live in `docs/`. For any task, open the one governing domain doc; don't load everything. Bias toward caution over speed; for trivial changes, use judgment.

## How we work

**Think before coding.** State assumptions explicitly; if uncertain, ask — don't hide confusion. If multiple interpretations exist, name them, don't silently pick one. If a simpler approach exists, say so and push back when warranted.

**Simplicity first.** Minimum code that solves the problem, nothing speculative: no features beyond what was asked, no abstractions for single-use code, no unrequested config, no error handling for impossible cases. If 200 lines could be 50, rewrite. Ask: "would a senior engineer call this overcomplicated?"
- **The one override:** the Non-negotiables below are *architecture, not gold-plating*. Never "simplify" `Blocks → IR → C` into `Blocks → C`, never inline the injectable clock, never add two-way block/text sync. If a rule below looks like unnecessary indirection, it isn't — leave it.

**Surgical changes.** Touch only what the task requires. Don't improve adjacent code, refactor things that work, or reformat. Match existing style even if you'd do it differently. Remove only the imports/vars *your* change orphaned; mention pre-existing dead code, don't delete it. Every changed line should trace to the request.

**Verify, don't eyeball.** Turn each task into a passing test before calling it done. "Add X" → write the test for X, make it pass. "Fix bug" → write a test that reproduces it, make it pass. Definition of done is the real gate, not a vibe: the relevant fixture **compiles in CI** and the runtime **trace is deterministic across repeated runs**. "Make it work" is not a success criterion; a green test is.

**Plan from the architecture — with one fixed ordering rule.** Derive *what to build next* from `docs/ARCHITECTURE.md` (and `docs/TASKS.md` if you want exit tests per step). The one sequence you may **not** reorder: **prove the runtime/clock spike (Phase 0) before any UI, Supabase, OAuth, or compiler work** — it's the only place the architecture can still be wrong, so it must be validated first, headless.

**One task → one doc; types have one home.** Open the governing domain doc, not the others. Each shared contract is defined in exactly one place — reference it, never re-paste (copies drift, which is the failure the IR exists to prevent):
- `ProgramIR` / `ExpressionIR` / `StatementIR` → `docs/domains/codegen.md`
- `PinboardProjectDocument` / `ComponentInstance` → `docs/domains/persistence.md`
- `BoardProfile` / `PinId` / `Diagnostic` → `docs/domains/hardware.md`
- Runtime (`ClockSource`, `FrameScheduler`, `RuntimeContext`, `RuntimeClock`) → `docs/domains/runtime.md`
When code exists, promote these to `src/*/types.ts` and point the docs at the code.

## Project-specific coding rules (things general guidelines can't know)

- **Determinism is mandatory in `runtime/` and `arduino/`.** No `Date.now()`, `performance.now()`, `Math.random()`, or `requestAnimationFrame` inside the interpreter, printer, or lowering. The interpreter reads time only from `ctx.clock.virtualTimeMs`; the scheduler is the only code that touches the injected `ClockSource`. The C printer is a pure function of IR. `random()` uses the seeded RNG. This is what keeps tests headless and reproducible.
- **Ask before extending the IR.** Lessons define the IR. If a task seems to need a new IR node, surface it — don't quietly add one to make a block work.
- **Never hardcode polarity or pin modes.** If you're about to type a literal `HIGH`/`LOW`/`INPUT_PULLUP` for a component, read its config instead (LED `activeHigh`, button `pullMode`; beginner `pinMode` is inferred).

## Non-negotiables (violating any is a bug, not a preference)

- **IR is the single source of truth.** Blocks → IR → (C printer | simulator | compiler). Never generate C and simulator behavior from separate paths. (ADR-0003)
- **One unified virtual clock.** `millis()` reads it; `delay(ms)` waits until the clock reaches a target; it advances from an **injected** `ClockSource` × speed, clamped per tick. The interpreter never reads browser time. No-delay `loop()` programs must still observe time passing. (ADR-0005)
- **Code preview is read-only.** No two-way block/text sync, ever. (ADR-0004)
- **Local-first.** The editor works fully with no account; a failed cloud write never touches local work; `.pinboard.json` export is the durable backup. (ADR-0006)
- **OAuth is optional**, never the workshop critical path. Primary CTA is "Start building." (ADR-0007)
- **The compile server generates its own C** from the project document and compiles only that — never a client-submitted string. Live compile is feature-gated; CI compile is the trusted minimum. (ADR-0008, ADR-0009)
- **Beginner mode infers `pinMode`;** explicit `pinMode` is advanced-only. (ADR-0010)
- **Editor mode filters the toolbox only.** Never hide, delete, or fail to load blocks already in a saved workspace.
- **Honesty gate.** If the simulator can do something the C printer can't emit as real Arduino, stop and flag it — do not ship the block.
- **Store derived data as cache, not truth.** Generated C, IR, source maps, and timestamps are regenerable and excluded from the project hash.
- **Blockly JSON, not XML,** for new saves. (ADR-0002)
- **No Next.js, Redis, R2, public gallery, AI tutor, WebSerial flashing, or classroom dashboard** in MVP+. (ADR-0001)
- **Minor-safe by default.** Minimize data, private by default, no third-party trackers, obvious export/delete.

## Where things live

- `docs/ARCHITECTURE.md` — the spine: goal, pipeline, principles, stack, routes, file layout, risks, acceptance criteria, and the map of which domain doc owns what.
- `docs/TASKS.md` — ordered build steps with an exit test each (optional if you plan from the architecture; the Phase-0-first rule above is the one part that is not optional).
- `docs/adr/` — the ten load-bearing decisions, one file each.
- `docs/domains/` — deep specs: `runtime`, `codegen`, `hardware`, `persistence`, `supabase`, `compiler`, `lessons`, `testing`.

When in doubt: open `ARCHITECTURE.md`, find the subsystem, open its domain doc.
