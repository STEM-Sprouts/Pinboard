# ADR-0009 — CI compile is the trusted minimum; live compile is feature-gated beta

**Status:** Accepted

## Context

A live compiler backend adds hosting, ops, and security surface that can over-scope a small team, and it is not needed to prove the generated C is real.

## Decision

CI compiles every canonical fixture with arduino-cli on each PR (required from Phase 1). A live compile backend is designed but **feature-gated, optional, and off the first-student path**; enabling it requires an explicit owner, budget, and security review.

## Consequences

- If the compiler is down or disabled, the simulator and preview must still work.
- Fixture assertions in CI: all sketches compile, no duplicate/conflicting `pinMode`, needed libraries included, deterministic printer output.
