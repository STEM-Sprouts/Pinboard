
```
 ____  _       _                         _
|  _ \(_)_ __ | |__   ___   __ _ _ __ __| |
| |_) | | '_ \| '_ \ / _ \ / _` | '__/ _` |
|  __/| | | | | |_) | (_) | (_| | | | (_| |
|_|   |_|_| |_|_.__/ \___/ \__,_|_|  \__,_|
```

**A block-based IDE for Arduino, Raspberry Pi, and ESP32 — built for the classroom.**

[🚀 Try Pinboard](https://pinboard.stemsprouts.org) · [📖 Docs](https://docs.stemsprouts.org) · [❤️ Donate](https://hcb.hackclub.com/donations/start/stem-sprouts) · [🐛 Report a Bug](https://github.com/STEM-Sprouts/pinboard/issues)

</div>

---

## What is Pinboard?

Pinboard is a **browser-based, block-based coding environment** that lets students write real hardware code — without the setup friction. Built by [STEM Sprouts](https://stemsprouts.org), a 501(c)(3) nonprofit, and used in live classroom sessions to teach IoT and physical computing to beginners.

Think Scratch, but the code actually runs on your Arduino.

```
Drag blocks → See generated C/MicroPython → Flash to hardware → Watch it work
```

No IDE installs. No driver headaches. No "it works on my machine."

---

## ✨ Features

### 🧩 Block-Based Editor
Powered by [Google Blockly](https://developers.google.com/blockly). Drag-and-drop blocks across 7 categories:

| Category | Description |
|---|---|
| **Structure** | `setup()`, `loop()`, boot events |
| **Pins** | Digital/analog read & write |
| **Control** | If/else, loops, delays |
| **Logic** | Comparisons, boolean operations |
| **Math** | Arithmetic, mapping, constraints |
| **Serial** | Print, println, serial monitor |
| **Variables** | Declare, set, get |

### 🔌 Hardware Modules
Add specialized sensor/actuator blocks without writing import boilerplate:

- 🌡️ **DHT11/DHT22** — Temperature & humidity
- 🔆 **Photoresistor** — Light sensing
- 🔘 **Button** — Digital input
- ⚙️ **Servo** — Position control
- *(more being added continuously)*

### 🖥️ Multi-Platform Support

| Platform | Language | Status |
|---|---|---|
| Arduino (Uno, Nano, Mega) | C/C++ | ✅ Stable |
| Raspberry Pi | MicroPython | ✅ Stable |
| ESP32 | C/C++ | 🔧 Coming soon |

Switch between platforms with a single click — the same blocks generate the correct language automatically.

### 🧪 In-Browser Emulator
Test your code **before touching hardware**. The emulator simulates sensor values and pin states directly in the browser. An improved emulator with richer hardware simulation is in active development — see **Pinboard 2.0** below.

### 🎓 Live Session Mode
Built for classrooms. Instructors generate a **join code** to start a live session. Students connect instantly — no accounts required. Sessions include:

- Real-time participant view
- **Breakout challenges** — groups divided by sensor type work on different problems simultaneously
- Session-scoped code sharing

### 📟 Arduino C Preview
Every block change instantly updates a live C/MicroPython preview at the bottom of the screen. Students see the real code their blocks produce — bridging visual and text-based programming.

---

## 🚀 Getting Started

### Try it instantly
No install needed → **[pinboard.stemsprouts.org](https://pinboard.stemsprouts.org)**

### Run locally

```bash
git clone https://github.com/STEM-Sprouts/pinboard.git
cd pinboard
npm install
npm run dev
```

**Requirements:** Node.js 18+, npm 9+

### Flash to hardware
1. Build your program with blocks
2. Click **Enter Code** to switch to text mode (optional)
3. Click **Run** — Pinboard compiles and flashes over WebSerial
4. Watch the Serial Monitor for output

> **Note:** WebSerial requires Chrome or Edge. Firefox is not currently supported.

---

## 🏗️ Pinboard 2.0 — IR-based architecture (in progress)

Pinboard is being rebuilt around a single **intermediate representation (IR)** so the
code preview can never lie about what the simulator does:

```
Blockly workspace → Project document → IR → { simulator | Arduino C printer | compile check }
```

The architecture spec (spine, ordered build plan, and per-domain docs for the
runtime, codegen, hardware, persistence, and compiler subsystems) lives in
[docs/](docs/) — start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the
ordered tracker [docs/TASKS.md](docs/TASKS.md) — and drives the phases below.

**Status: Phases 0–3 complete, including optional cloud save (Phase 2) — live-verified against Supabase with RLS tests. Remaining: Google OAuth provider config, feature-gated compile backend (Phase 4), share links (Phase 5).**

Phase 0 — headless runtime spike (done):
- ✅ Canonical IR types (`src/ir/`) and audited Arduino Uno board profile (`src/hardware/`)
- ✅ Generator-based IR interpreter with cooperative yielding — a tight `while(true)` cannot freeze the tab (`src/runtime/`)
- ✅ Unified virtual clock: `millis()` and `delay()` share one injected clock; deterministic and headless in Node (ADR-0005)
- ✅ IR → Arduino C printer with beginner `pinMode` inference (`src/arduino/`)
- ✅ Runtime tests 1–16 + printer golden tests (`npm test`), driven by synthetic clock/frame schedulers

Phase 1 — learning-loop MVP (complete):
- ✅ **The editor now runs the honest pipeline**: Blocks → IR → { C preview | IR simulator }. The old
  mock compile (a hard-coded blink hex that ignored your blocks) is gone — Run executes *your* program.
- ✅ Blocks→IR lowering (`src/editor/`) as a pure, tested function of the Blockly JSON
- ✅ Default starter project (Blink) — students never open onto a blank canvas
- ✅ Local-first persistence: debounced LocalStorage autosave, reload restore,
  `.pinboard.json` export/import with Zod boundary validation (`src/persistence/`)
- ✅ Board diagnostics in the hardware panel: non-PWM `analogWrite`, D0/D1 serial pins,
  timer conflicts, analog-read errors, no-loop / no-output hints (`src/hardware/diagnostics.ts`)
- ✅ CI: typecheck + lint + unit tests, and an arduino-cli job that compiles every canonical
  fixture generated from IR (`.github/workflows/`)
- ✅ **Dynamic component system**: add/remove LED, Button, Potentiometer instances; board-aware
  pin picker (capability + availability + used-by context per pin); component blocks
  (`turn LED on`, `is pressed?`, `read pot`) that lower through instance config —
  active-low LEDs emit opposite writes, button pull mode decides the pressed comparison
- ✅ Component-binding diagnostics: pin conflicts, unconnected components, and the
  "your program writes D13 but nothing is connected" teaching warning
- ✅ Starter project ships with hardware pre-added (LED on D13, Button on D2)
- ✅ First two lessons drafted (content before engine): Blink, Button Controls LED (`src/lessons/content/`)
- ✅ **Lesson panel + checks**: pick a lesson, follow steps, press "Check my work" —
  checks inspect the project document, the IR, and a headless simulation trace
  ("the LED really blinks"), never the generated code text; progress persists
  into the project document (`src/lessons/`)
- ✅ **Variables / Logic / Math / Time blocks**: variables (create/set/change/get, lowered
  to zero-initialized globals so counters survive `loop()`), if/else, comparisons,
  and/or/not, wait-until (negation folded into readable C), arithmetic, inclusive
  random, Arduino `map()`, and `millis()`
- ✅ **CodeMirror 6 read-only preview**: line numbers + C++ highlighting; strictly
  one-way blocks→code (typing does nothing, E2E-enforced)
- ✅ **Line↔block source map**: the printer emits a `CodeSourceMap`; selecting a
  block highlights exactly its printed lines in the preview — the same map will
  carry compiler error→block diagnostics later (`src/arduino/sourceMap.ts`)
- ✅ **Full beginner/intermediate block library**: PWM write, for-range,
  constrain/min/max/abs, comments, plus component convenience blocks
  (LED brightness & blink, button wait-until-pressed, pot map/threshold) —
  every one lowering through instance config, never hardcoded polarity
- ✅ **Seven lessons**: Blink, Change Blink Speed, Button Controls LED,
  Potentiometer Controls Brightness, Blink Without Delay (millis), Servo
  Sweep, Buzzer Alarm — checks run the program headless and assert on the
  real trace ("the LED really blinks", "the arm really sweeps")
- ✅ **Editor modes**: beginner / intermediate / advanced filter what the toolbox
  *offers* only; a mode switch can never touch blocks already in the workspace
  (E2E-enforced), and the mode persists in the project document
- ✅ Playwright E2E suite (22 flows) runs as its own CI job alongside
  typecheck/lint/unit and the arduino-cli fixture-compile job
- ✅ **Buzzer & Servo** (Phase 3): placeable components with live panel visuals
  (tone Hz, angle dial), blocks that lower through instances (Servo.h and
  attach() appear in setup() automatically), timer-conflict warnings, and
  diagnostic quick fixes ("Move LED 1 to D13" — offered, never auto-applied)
- ✅ **Cloud save (Phase 2, optional path)**: env-gated Supabase client (no keys →
  purely local app, E2E-asserted), "Save to my account" promotion ask (nothing
  uploads silently), debounced cloud autosave with normalized-hash dedup,
  conflict prompt (keep local / use cloud / duplicate), `/projects` merges
  local + cloud rows — live RLS tests prove user isolation
- ⏳ Next: Google OAuth provider config, feature-gated compile backend
  (Phase 4), share links (Phase 5)

---

## 🗂️ Project Structure

```
pinboard/
├── src/
│   ├── blocks/          # Blockly block definitions + component-block registry
│   ├── components/      # React UI (workspace, hardware panel, pin picker, code preview)
│   ├── editor/          # Blocks→IR lowering, starter project
│   ├── ir/              # Pinboard 2.0: canonical IR types + walkers
│   ├── hardware/        # Board profiles, components, diagnostics engine
│   ├── runtime/         # IR interpreter, scheduler, virtual clock
│   ├── arduino/         # IR → Arduino C printer + pinMode inference
│   ├── persistence/     # Project document, LocalStorage store, import/export
│   ├── lessons/         # Lesson content (plain text first)
│   └── testing/         # Synthetic clock/frame harness, IR builders, fixtures
├── e2e/                 # Playwright end-to-end tests
└── public/
```

### Running the tests

```bash
npm test                 # Vitest: runtime, lowering, diagnostics, persistence
npx playwright test      # E2E: drives the real app in Chromium
```

---

## 🤝 Contributing

We welcome contributions! Pinboard is built by a small team and there's always more to build.

**Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR.**

Quick ways to help:
- 🐛 [Report bugs](https://github.com/STEM-Sprouts/pinboard/issues/new?template=bug_report.md)
- 💡 [Suggest features](https://github.com/STEM-Sprouts/pinboard/issues/new?template=feature_request.md)
- 🧩 Add new hardware module blocks
- 🌍 Translate the UI
- 📖 Improve documentation

---

## ❤️ Supporting STEM Sprouts

Pinboard is free because STEM Sprouts is donor-funded. If this project is useful to you or your students, please consider donating.

**[→ Donate to STEM Sprouts (501c3, tax-deductible)](https://hcb.hackclub.com/donations/start/stem-sprouts)**

All donations go directly to running programs, hardware kits for students, and infrastructure costs.

---

## 📄 License

MIT © [STEM Sprouts](https://stems-prouts.org)

Pinboard is free and open source. Built with [Google Blockly](https://github.com/google/blockly) and [WebSerial API](https://developer.chrome.com/docs/capabilities/serial).

---

<div align="center">
  <sub>Built with ❤️ by STEM Sprouts — making hardware accessible to every student.</sub>
</div>
