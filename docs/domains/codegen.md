# Domain: Codegen (blocks → IR → Arduino C)

Owns the **canonical IR types** (`ProgramIR`, `ExpressionIR`, `StatementIR`) and the block library, lowering, and C printer. Governs ADR-0002, ADR-0003, ADR-0010. Every other doc references these types; do not re-paste them.

## 1. Why IR exists

Direct Blockly→C and Blockly→simulator creates two meanings for one program and drifts. The IR closes the gap: **Block tree → IR → { C printer, simulator, compile }**. Add IR nodes only when a lesson or supported component needs them (lessons define the IR).

## 2. Program IR (canonical)

```ts
type ProgramIR = {
  schemaVersion: 1;
  boardId: BoardId;                 // hardware.md
  includes: IncludeIR[];
  globals: GlobalIR[];
  setup: StatementIR[];
  loop: StatementIR[];
  metadata: {
    sourceProjectHash: string;
    generatedAt: string;
    generatorVersion: string;
  };
};
```

## 3. Expressions (canonical) — reads are values, not just statements

```ts
type ExpressionIR =
  | { kind: 'num'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'string'; value: string }
  | { kind: 'var'; name: string }
  | { kind: 'read'; op: 'digital'; pin: PinId }
  | { kind: 'read'; op: 'analog'; pin: PinId }
  | { kind: 'millis' }
  | { kind: 'unary'; op: 'not' | 'neg'; arg: ExpressionIR }
  | {
      kind: 'binary';
      op: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||';
      left: ExpressionIR;
      right: ExpressionIR;
    }
  | { kind: 'call'; fn: 'map' | 'constrain' | 'min' | 'max' | 'abs' | 'random'; args: ExpressionIR[] };
```

Reads must be usable inside `if`, comparisons, math, assignments, and serial prints — e.g. `if (digitalRead(2) == LOW) { digitalWrite(13, HIGH); }`.

## 4. Statements (canonical)

```ts
type StatementIR =
  | { kind: 'declare'; name: string; valueType: ValueType; initial?: ExpressionIR; scope: 'global' | 'local' }
  | { kind: 'assign'; name: string; value: ExpressionIR }
  | { kind: 'change'; name: string; delta: ExpressionIR }
  | { kind: 'pinMode'; pin: PinId; mode: 'INPUT' | 'INPUT_PULLUP' | 'OUTPUT'; explicit: boolean }
  | { kind: 'digitalWrite'; pin: PinId; value: ExpressionIR }
  | { kind: 'analogWrite'; pin: PinId; value: ExpressionIR }
  | { kind: 'delay'; ms: ExpressionIR }
  | { kind: 'delayMicroseconds'; us: ExpressionIR }
  | { kind: 'serialPrint'; value: ExpressionIR; newline: boolean }
  | { kind: 'tone'; pin: PinId; frequency: ExpressionIR; durationMs?: ExpressionIR }
  | { kind: 'noTone'; pin: PinId }
  | { kind: 'servoAttach'; servoId: string; pin: PinId }
  | { kind: 'servoWrite'; servoId: string; angle: ExpressionIR }
  | { kind: 'if'; condition: ExpressionIR; then: StatementIR[]; else?: StatementIR[] }
  | { kind: 'repeat'; times: ExpressionIR; body: StatementIR[] }
  | { kind: 'while'; condition: ExpressionIR; body: StatementIR[] }
  | { kind: 'forRange'; varName: string; from: ExpressionIR; to: ExpressionIR; step: ExpressionIR; body: StatementIR[] }
  | { kind: 'comment'; text: string };
```

## 5. Block library (toolbox)

Workspace modes gate the **toolbox only** (never the loaded workspace — see persistence.md §editor mode). Categories: Structure · Components · Pins · Control · Logic · Math · Variables · Time · Serial.

- **Structure:** when program starts (`setup()`) · forever (`loop()`) · comment.
- **Components (appear when the component is added):** LED (turn on/off, set brightness, blink) · Button (is pressed?, wait until pressed) · Potentiometer (read, map to range, threshold) · Buzzer (play tone [for ms], stop) · Servo (set angle, sweep from a to b, attach).
- **Pins (intermediate):** set digital HIGH/LOW · read digital · read analog · set PWM value · configure pin mode (advanced).
- **Control:** if/else · repeat n times · while · for value from a to b (`forRange`) · wait ms (`delay`) · wait until condition · stop (future).
- **Logic/Math:** `== != < <= > >= && || !`, arithmetic `+ - * / %`, `map`, `constrain`, `min`, `max`, `abs`, `random(min,max)` (seeded).
- **Variables (global by default):** create · set · change by · value · print.
- **Time:** wait ms · wait microseconds (advanced) · milliseconds since start (`millis()`) · blink-without-delay helper (millis-based).
- **Serial:** start serial (usually inferred) · print · println · clear (UI) · graph (future).

## 6. Lowering rules (the ones that bite)

**LED — read `activeHigh`, never hardcode:**
```txt
turn Red LED on  →  { kind:'digitalWrite', pin:'D13', value:{ kind:'bool', value: activeHigh } }
```
Active-high LED "on" → HIGH; active-low LED "on" → LOW. (Runtime test 17 asserts opposite writes.)

**Button — read `pullMode`, never hardcode LOW:**
```txt
internal pull-up:  digitalRead(2) == LOW
external pull-down: digitalRead(2) == HIGH
```
IR: `{ kind:'binary', op:'==', left:{kind:'read',op:'digital',pin:'D2'}, right:{kind:'bool',value:false} }`.

**Potentiometer mapped brightness:**
```cpp
analogWrite(9, map(analogRead(A0), 0, 1023, 0, 255));
```

**Inferred `pinMode` (beginner mode; ADR-0010):** the printer collects pin usage and emits one mode per pin in `setup()`:
```txt
digitalWrite(D13) → D13 OUTPUT
analogWrite(D9)   → D9 OUTPUT
digitalRead(D2) with button internal_pullup → D2 INPUT_PULLUP
analogRead(A0)    → no pinMode
```
If an explicit advanced `pinMode` conflicts with the inferred mode, raise a diagnostic. Beginner mode never exposes raw `pinMode`.

**Library hoisting:** Servo usage auto-adds `#include <Servo.h>`, declares `Servo servoN;`, and hoists `servoN.attach(pin)` into `setup()` even if the block appears in the loop (or diagnose "attach belongs in setup" in advanced mode).

**Variable hoisting:** all beginner variables are globals, emitted above `setup()`, so counters persist across `loop()` passes. Never declare a beginner variable inside `loop()` unless the block explicitly says local.

## 7. Printer style rules

2-space indent · includes first · globals second · `setup()` third · `loop()` fourth · one statement per line · preserve lesson comments · no duplicate `pinMode` · no unused helpers · **deterministic output** (for snapshot/compile tests). Escape strings; generate unique variable names.

Sample:
```cpp
// Generated by Pinboard
// Board: Arduino Uno

void setup() {
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  if (digitalRead(2) == LOW) {
    digitalWrite(13, HIGH);
    Serial.println("Button pressed");
  } else {
    digitalWrite(13, LOW);
  }
  delay(20);
}
```

## 8. Arduino C support matrix (MVP+)

Yes: `setup()/loop()`, `pinMode` (inferred/explicit), `digitalWrite/Read`, `analogRead/Write`, `delay`, `millis`, `Serial.begin` (inferred) / `print` / `println`, `tone`/`noTone`, `map`, `constrain`, `random` (seeded), `Servo.h`/`Servo.write`. Future: `pulseIn` (ultrasonic), interrupts, arrays, user functions.

## 9. No fake code · helpers · random · memory · source map

- **No fake code.** If the simulator supports a block but the printer cannot emit real Arduino C for it, the block does not ship. `wait until button pressed` prints a real `while (digitalRead(2) == HIGH) { }` (and lessons explain it spins on real hardware).
- **Helpers** only when needed, and carefully — they can hide the code students are meant to learn.
- **`random`** is simulator-deterministic (seeded). Do not emit `randomSeed(analogRead(A0))` by default; it conflicts with real analog sensor use. Only emit it if a lesson teaches randomness.
- **Memory:** Uno SRAM is tiny. Avoid heavy `String`; prefer literals in `Serial.print` and numeric prints.
- **Source map** for line ↔ block highlighting (full compiler-error mapping is later):
```ts
type CodeSourceMap = {
  cLineToBlockId: Record<number, string>;
  blockIdToLineRange: Record<string, { start: number; end: number }>;
};
```

## 10. `delay`/`millis` runtime semantics

Codegen emits the calls; the runtime defines their timing behavior on the unified virtual clock — see `runtime.md` §8.

---

**Cross-refs:** `PinId`/`BoardProfile` → `hardware.md`. Execution semantics → `runtime.md`. Compile validation → `compiler.md`. Determinism tests → `testing.md`.
