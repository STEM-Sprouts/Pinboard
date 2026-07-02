# ADR-0004 — The code preview is read-only (one-way blocks → code)

**Status:** Accepted

## Context

Two-way block/text sync is a large, fragile feature that competes with the learning goal: students should see what their blocks *become*, not edit generated text that must round-trip.

## Decision

The CodeMirror preview is strictly read-only. Blocks → code, never code → blocks. Enforced in the editor state (`EditorState.readOnly`, `EditorView.editable(false)`) and by an E2E test that types into the preview and asserts nothing changes.

## Consequences

- CodeMirror 6 (not a plain highlighter) is still required: line↔block gutters and inline compiler diagnostics attach to it (`CodeSourceMap`, `docs/domains/codegen.md` §9).
- "Enter Code" text-editing modes are out of scope for Pinboard 2.0.
