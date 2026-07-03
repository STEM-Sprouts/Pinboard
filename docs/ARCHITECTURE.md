# Pinboard 2.0 — Architecture (the spine)

This is the cross-cutting spine. It holds the pipeline, the invariants, and the map of where detail lives. It deliberately does **not** duplicate the domain specs. For any subsystem, follow the link to `docs/domains/*.md`. For the ordered build plan, see `docs/TASKS.md`. For the load-bearing decisions, see `docs/adr/`.

Source of record: `pinboard-2-react-mvp-plus-architecture-spec-round-6.md`. This folder is the working decomposition of that spec.

---

## 1. Product goal

Pinboard is a beginner-friendly hardware programming environment that teaches the connection between physical components, microcontroller pins, blocks, Arduino C, and runtime behavior. The target user can answer:

> "When I drag this block, what Arduino code does it become, and what does that code do to the circuit?"

It is a **guided learning environment**, not a bare Blockly canvas.

---

## 2. The pipeline (this is the whole product)

```txt
Blockly Workspace (JSON)
        │
        ▼
PinboardProjectDocument        ← source of truth on disk (persistence.md)
        │
        ▼
        IR                     ← single source of truth in memory (codegen.md, ADR-0003)
   ┌────┴─────┬───────────────┐
   ▼          ▼               ▼
Simulator   Arduino C     Compile check
(runtime)   printer       (CI / optional live)
   │          │               │
   ▼          ▼               ▼
Hardware    Read-only      arduino-cli
panel +     CodeMirror     (compiler.md)
serial      preview
```

The simulator executes IR. The code preview prints Arduino C **from IR**. The compiler compiles the C printed **from IR**. One intermediate, all consumers share it — so the preview cannot lie about the simulator.

---

## 3. Architecture principles

1. **Local-first.** The editor works with no account; workshops survive OAuth/Wi-Fi failure. (ADR-0006)
2. **Cloud-enhanced, not cloud-dependent.** Supabase improves persistence; it is never required to complete a lesson.
3. **IR is the source of truth.** Never generate C and simulator behavior on separate paths. (ADR-0003)
4. **Code preview is read-only.** One-way blocks → code. (ADR-0004)
5. **Beginner mode infers correctness.** No forced `pinMode`, includes, or servo attach unless the lesson teaches them. (ADR-0010)
6. **Diagnostics teach, not just block.** State what is wrong, why it matters, whether it is fatal, and how to fix it.
7. **Real hardware truth, simplified.** Honest enough to teach real Arduino semantics; not a SPICE simulator.
8. **Lessons define the IR.** Add IR nodes only when a lesson or supported component needs them.
9. **Compile validates generated code.** CI compile proves the printer emits real sketches; the simulator is the interactive path.
10. **Privacy by default.** Minors. Minimize data, avoid public exposure, make export/delete obvious.

---

## 4. Selected stack

| Layer | Choice | Reason |
|---|---|---|
| App | React | Existing codebase, ecosystem fit |
| Build | Vite | Fast dev/build; static output deployable to Vercel |
| Routing | React Router | Covers editor, dashboard, project, auth-callback routes |
| UI | Tailwind + small primitives | Fast, consistent |
| Blocks | Blockly | Core visual programming |
| Code preview | CodeMirror 6 | Line mapping, gutters, inline diagnostics (highlight.js is display-only) |
| State | Zustand or Context + reducers | Explicit, testable |
| Validation | Zod | `.pinboard.json` imports, Supabase rows, compiler responses |
| Testing | Vitest + RTL + Playwright | Unit, component, E2E |
| Auth/DB | Supabase (Auth + Postgres + RLS) | Optional cloud save |
| Compile | GitHub Actions + arduino-cli (CI); optional external worker (live) | Validate generated C safely |

**Explicitly rejected:** Next.js (ADR-0001). Client-heavy editor, no SSR benefit, migration tax.

---

## 5. Non-goals for MVP+

Next.js migration · SSR for the editor · teacher dashboard · public gallery · AI tutor · WebSerial flashing · Raspberry Pi / ESP32 parity · full project version history · Redis · Cloudflare R2. The live compiler backend is **designed** but feature-gated and off the first-student path.

---

## 6. User experience & routes

First-time student: open → choose Arduino Uno → pick a starter lesson → hardware pre-added → drag/modify blocks → Arduino C updates live → Run → simulated circuit responds → save locally → sign in only if they want cloud sync.

React Router routes (all client routes; Vercel rewrites all non-API paths to `index.html`):

```txt
/                        Landing / board picker
/editor/new              New local project
/editor/:localId         Local project
/projects                Signed-in project list
/projects/:projectId     Cloud project editor
/auth/callback           Supabase OAuth redirect handler
/share/:token            View shared project (if enabled)
/settings                Account / project settings
```

---

## 7. Feature scope (MVP+)

**Learning loop (required):** Arduino Uno profile · dynamic component panel · LED/Button/Potentiometer/Buzzer/Servo · board-aware pin picker · pin/wiring diagnostics · Blockly workspace · beginner/intermediate block library · Blocks→IR lowering · IR→Arduino C printer · IR simulator · read-only CodeMirror preview · serial monitor · Run/Stop/Reset · LocalStorage autosave · `.pinboard.json` import/export · 2–4 lessons · Vitest · one Playwright flow · CI compile tests.

**Cloud persistence (MVP+):** Supabase Auth · Google OAuth (+ magic-link fallback) · project table + RLS · cloud save · local↔cloud promotion/fallback · export as durable backup.

**Feature-gated beta:** live compiler backend · share/remix links · more components · more lessons.

---

## 8. Implementation file structure

```txt
src/
  app/            App.tsx, routes/ (Home, Editor, Projects, AuthCallback)
  editor/         BlocklyWorkspace, CodePreview, toolbox/, blocklySerialization.ts
  hardware/       boards/arduinoUno.ts, components/*, registry.ts, pinPicker.tsx, diagnostics.ts
  ir/             types.ts, lowerBlocklyToIR.ts, validateIR.ts
  arduino/        printArduino.ts, pinModeInference.ts, sourceMap.ts, fixtures/
  runtime/        scheduler.ts, interpreter.ts, expressions.ts, pinState.ts, serialBuffer.ts, seededRandom.ts
  persistence/    projectDocument.ts, localProjectStore.ts, importExport.ts, migrations.ts, schemas.ts
  supabase/       client.ts, auth.ts, projectRepository.ts
  lessons/        lessonTypes.ts, lessons/{blink-led, button-controls-led}.ts
  testing/        builders.ts
```

The shared type contracts (`ir/types.ts`, `persistence/projectDocument.ts`, `hardware/boards`, runtime types) are the eventual homes for the contracts currently defined in the domain docs.

---

## 9. Which domain doc owns what

| Domain doc | Owns (canonical types in **bold**) |
|---|---|
| `domains/codegen.md` | **`ProgramIR`, `ExpressionIR`, `StatementIR`**; block library; Blocks→IR lowering; C printer + style; `pinMode` inference; variable/library hoisting; Arduino-C support matrix; `CodeSourceMap` |
| `domains/runtime.md` | **`ClockSource`, `FrameScheduler`, `RuntimeContext`, `RuntimeClock`**; interpreter; cooperative yielding; scheduler + `advanceClock`; virtual clock; pin state store; component simulation; runtime tests |
| `domains/hardware.md` | **`BoardProfile`, `PinId`, `Diagnostic`**; Arduino Uno profile; pin picker; error/warning rules; dynamic component system; pin/component binding diagnostics |
| `domains/persistence.md` | **`PinboardProjectDocument`, `ComponentInstance`**; editor-mode/toolbox rule; LocalStorage; save states/conflict/hash; import/export + Zod + migrations |
| `domains/supabase.md` | Auth flow; schema; RLS policies; share RPC; anonymous-auth caution; security & privacy |
| `domains/compiler.md` | Compile boundary; server flow; worker constraints; `CompileResult`; CI compile job + fixtures |
| `domains/lessons.md` | `Lesson`/`LessonCheck` types; first lessons; content rule |
| `domains/testing.md` | Unit/runtime/E2E strategy; fixtures; differential test; fitness functions; performance budgets |

---

## 10. Risk register

| Risk | P | Impact | Mitigation |
|---|---:|---:|---|
| Runtime interpreter becomes too broad | High | High | Lessons define IR |
| Tight loop freezes browser | Med | High | Cooperative yield + tests |
| OAuth blocked in school | Med | High | Local-first mode |
| Compiler backend over-scopes team | High | High | CI compile first, live compile beta |
| Code preview lies about simulator | Med | High | IR-first printer/runtime |
| Weak lessons hurt learning | High | High | Assign curriculum owner |
| Project save conflict loses work | Med | High | Local save authoritative |
| RLS bug exposes projects | Med | High | Policy tests + private default |
| Dynamic components become messy | Med | Med | Rule of three before abstraction |
| Arduino C generation gets brittle | Med | High | Compile fixtures + deterministic printer |

---

## 11. Acceptance criteria (the definition of done)

**Learning loop:** a student can open Pinboard → choose Arduino Uno → add LED on D13 → add Button on D2 → build blocks where the button controls the LED → see generated Arduino C → run the simulator → press the virtual button → see the LED turn on/off → save locally → reload and continue.

**Codegen:** canonical fixtures compile with arduino-cli; no duplicate/conflicting `pinMode`; needed libraries included; deterministic output; CodeMirror maps lines to blocks.

**Runtime:** delay and tight loops do not freeze the browser; variables persist across loop iterations; `millis()` uses the virtual clock; inputs update while the runtime cooperatively yields; stop/reset are reliable.

**Persistence:** LocalStorage autosave works; imports are validated; malformed imports fail safely; signed-in cloud save works; cloud failure does not lose local work.

**Security:** RLS prevents reading another user's private project; share tokens expire and are revocable; the compiler (if enabled) compiles only server-generated code; OAuth failure does not block the local editor.
