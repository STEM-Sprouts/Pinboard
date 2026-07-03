# ADR-0006 — Local-first persistence

**Status:** Accepted

## Context

Pinboard runs in live classroom workshops where Wi-Fi, OAuth approval, and cloud services can and do fail. Minors on shared Chromebooks are the primary users.

## Decision

The editor works fully with no account: debounced LocalStorage autosave, reload restore, and `.pinboard.json` export/import as the durable backup (`docs/domains/persistence.md`). Cloud save (Supabase) enhances persistence but is never required to complete a lesson. A failed cloud write never touches local work; local save is authoritative in conflicts.

## Consequences

- Every feature must have a no-account path; cloud is a promotion, not a prerequisite.
- Storage failures warn the student instead of silently discarding work.
- Export/delete must stay obvious in the UI (minor-safe defaults).
