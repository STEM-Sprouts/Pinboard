# ADR-0002 — Blockly JSON serialization, not XML

**Status:** Accepted

## Context

Blockly supports two serialization formats. XML is the legacy format; JSON is the modern serializer and composes cleanly with the Zod-validated `.pinboard.json` project document.

## Decision

All new saves store the workspace as Blockly JSON inside `PinboardProjectDocument` (see `docs/domains/persistence.md`). No new XML is written.

## Consequences

- Import validation and migrations operate on one format.
- If legacy XML projects ever need importing, that is an explicit migration, not a dual code path.
