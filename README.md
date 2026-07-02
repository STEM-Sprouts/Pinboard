
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
runtime, codegen, hardware, persistence, and compiler subsystems) is maintained
as private planning docs and drives the phases below.

**Status: Phase 0 complete.** The headless runtime spike is built and tested:

- ✅ Canonical IR types (`src/ir/`) and audited Arduino Uno board profile (`src/hardware/`)
- ✅ Generator-based IR interpreter with cooperative yielding — a tight `while(true)` cannot freeze the tab (`src/runtime/`)
- ✅ Unified virtual clock: `millis()` and `delay()` share one injected clock; deterministic and headless in Node (ADR-0005)
- ✅ IR → Arduino C printer with beginner `pinMode` inference (`src/arduino/`)
- ✅ Runtime tests 1–16 + printer golden tests (`npm test`), driven by synthetic clock/frame schedulers
- ⏳ Phase 1 next: dynamic component panel, board-aware pin picker, diagnostics, CodeMirror read-only preview, LocalStorage persistence, lessons

The current UI still runs the v1 prototype path (Blockly → C string + avr8js mock);
it is replaced as Phase 1 wires the new runtime into the editor.

---

## 🗂️ Project Structure

```
pinboard/
├── src/
│   ├── blocks/          # v1 Blockly block definitions & C generator
│   ├── components/      # React UI (workspace, simulation panel, code preview)
│   ├── emulator/        # v1 avr8js-based emulator (being replaced)
│   ├── ir/              # Pinboard 2.0: canonical IR types
│   ├── hardware/        # Pinboard 2.0: board profiles, pin & diagnostic types
│   ├── runtime/         # Pinboard 2.0: IR interpreter, scheduler, virtual clock
│   ├── arduino/         # Pinboard 2.0: IR → Arduino C printer + pinMode inference
│   └── testing/         # Synthetic clock/frame harness, IR builders, fixtures
├── e2e/                 # Playwright end-to-end tests
├── implemenation_plam/  # Architecture spec, domain docs, ordered build plan
└── public/
```

### Running the tests

```bash
npm test                 # Vitest: runtime tests 1–16 + printer golden tests (headless)
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
