# ADR-0003 — The IR is the single source of truth

**Status:** Accepted

## Context

Generating Arduino C directly from blocks *and* simulating blocks on a separate path creates two meanings for one program; they drift, and the code preview ends up lying about what the simulator does.

## Decision

One pipeline: `Blocks → IR → { C printer | simulator | compile check }`. Every consumer reads the same `ProgramIR` (`docs/domains/codegen.md`). Never generate C and simulator behavior from separate paths. IR nodes are added only when a lesson or supported component needs them ("lessons define the IR").

## Consequences

- The preview cannot lie about the simulator; the CI compile job proves the printer emits real sketches.
- The honesty gate: if the simulator can do something the printer can't emit as real Arduino C, the block does not ship.
- Derived artifacts (generated C, IR, source maps) are cache, not truth, and are excluded from the project hash.
