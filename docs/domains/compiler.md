# Domain: Compiler (CI compile + live-backend boundary)

Governs ADR-0008, ADR-0009. CI compile tests are **required** and are the trusted minimum. A live compiler backend is **feature-gated, optional, and never on the first-student path.**

## 1. The boundary (non-negotiable)

The compile server **lowers the project document to IR and prints the Arduino C itself**, then compiles only that. It never compiles a client-submitted code string.

Why: a malicious client can send arbitrary C++ and set a `generated_by_pinboard: true` flag; string scanning is not a boundary. The only safe boundary is:

```txt
Client sends project document
Server generates code itself (project doc → IR → C)
Server compiles only its own generated code
```

## 2. Server flow

Input:
```json
{ "projectDoc": {}, "boardId": "arduino-uno", "requestedArtifact": "verify" }
```

```txt
Validate projectDoc
→ Lower projectDoc to IR on server
→ Print Arduino C on server
→ Hash generated source
→ Check compile cache (supabase.md: compile_cache)
→ Compile with arduino-cli in sandbox/container
→ Return success/errors/memory/artifact metadata
```

Response:
```ts
type CompileResult = {
  status: 'success' | 'error';
  boardFqbn: string;
  sourceHash: string;
  stdout: string;
  stderr: string;
  memory?: { flashBytes?: number; sramBytes?: number };
  diagnostics: CompileDiagnostic[];
};
```

Diagnostics map compiler line → C line → block id via `CodeSourceMap` (codegen.md). MVP+ minimum: a compiler error at line N highlights line N in CodeMirror. Later: line N → originating block.

## 3. Hosting reality

A Vite React app on Vercel is static and cannot run arduino-cli in the browser. Options:

| Option | Pros | Cons |
|---|---|---|
| External container worker | Correct place for arduino-cli | Adds hosting/ops |
| Vercel Function broker + external worker | Good API boundary | Still needs the worker |
| Supabase Edge Function broker + external worker | Fits Supabase auth | Edge function can't run the toolchain |
| CI-only compile tests | Safe and cheap | Not live for users |

**Selected MVP+ posture:** CI compile tests are required; a live compiler backend is beta/optional. If live compile is insisted on, allocate an explicit owner, budget, and security review.

## 4. Compile-worker constraints (if live compile is enabled)

Allowlisted boards only · allowlisted libraries only · no network during compile · isolated temp directory · timeout (~10s) · max source size · max stdout/stderr size · no upload/flashing · no arbitrary file reads · no remote-URL includes · container image pinned by digest · logs scrubbed of tokens · rate-limit by authenticated user or session token, **not only IP** (a classroom shares one NAT). If the compiler fails or is disabled, the simulator and preview must still work.

## 5. CI compile tests (required from Phase 1)

Prove the generated C is real by compiling canonical fixtures on every PR.

Fixtures (`.pinboard.json`, reused by `testing.md` and Playwright):
```txt
fixtures/
  blink-led.pinboard.json
  button-controls-led.pinboard.json
  potentiometer-brightness.pinboard.json
  buzzer-alarm.pinboard.json
  servo-sweep.pinboard.json
  blink-without-delay.pinboard.json
```

For each fixture: load project → lower to IR → print Arduino C → write `Sketch.ino` → `arduino-cli compile --fqbn arduino:avr:uno Sketch`.

GitHub Action (cache the AVR core — it is large and slow):
```yaml
name: arduino-compile
on: [pull_request, push]
jobs:
  compile-fixtures:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Cache Arduino
        uses: actions/cache@v4
        with:
          path: ~/.arduino15
          key: arduino-${{ runner.os }}-avr-v1
      - name: Install Arduino CLI
        uses: arduino/setup-arduino-cli@v2
      - name: Install AVR core
        run: |
          arduino-cli core update-index
          arduino-cli core install arduino:avr
      - name: Generate sketches
        run: npm run generate:arduino-fixtures
      - name: Compile sketches
        run: npm run test:arduino-compile
```

Assert: all canonical sketches compile · no duplicate/conflicting `pinMode` · no undefined variables · servo sketches include `Servo.h` · serial sketches include `Serial.begin` · PWM sketches use valid pins or produce warnings · printer output is deterministic.

## 6. Differential test (stretch, testing.md)

For selected fixtures: run the IR simulator → collect pin/serial trace; compile the generated C → run HEX in avr8js → collect trace; compare. This is the strongest honesty check and is enabled by CI compile. Not launch-blocking.

---

**Cross-refs:** project doc/IR/printer → `persistence.md`, `codegen.md`. `compile_cache` table → `supabase.md`. Fixture assertions → `testing.md`.
