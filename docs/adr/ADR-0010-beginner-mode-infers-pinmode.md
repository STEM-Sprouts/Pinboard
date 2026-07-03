# ADR-0010 — Beginner mode infers `pinMode`

**Status:** Accepted

## Context

Forcing beginners to place `pinMode`, includes, and servo-attach boilerplate before anything works kills the first-five-minutes experience — but the generated C must still be real, correct Arduino code.

## Decision

The printer infers pin modes from usage and emits one `pinMode` per pin in `setup()` (`docs/domains/codegen.md` §6): `digitalWrite`/`analogWrite` → `OUTPUT`; button reads follow the instance `pullMode` (internal pull-up → `INPUT_PULLUP`); `analogRead` needs no `pinMode`. Explicit `pinMode` is an advanced-mode block only; if an explicit mode conflicts with the inferred one, raise a diagnostic. Never hardcode polarity or pull modes in lowering — read the component config (`activeHigh`, `pullMode`).

## Consequences

- Lesson 1 is drag-two-blocks simple, yet the preview shows a complete, compilable sketch.
- Inference lives in one place (`src/arduino/pinModeInference.ts`) and is unit-tested.
- Editor modes gate the toolbox only — never blocks already in a saved workspace.
