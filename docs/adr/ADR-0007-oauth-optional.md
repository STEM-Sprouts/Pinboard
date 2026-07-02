# ADR-0007 — OAuth is optional, never the workshop critical path

**Status:** Accepted

## Context

Google Workspace admins can block unapproved third-party OAuth apps; a workshop cannot stall on a sign-in screen.

## Decision

The primary CTA is **"Start building"**, not "Sign in". Google OAuth (plus email magic-link fallback) exists only for users who want cloud save (`docs/domains/supabase.md`). If OAuth fails or is blocked: local mode → export `.pinboard.json` → import later. On sign-in, local projects are not silently uploaded; the app asks before creating a cloud copy.

## Consequences

- Auth UI is additive; removing it must leave a fully working editor.
- Anonymous auth is treated with caution (orphaned projects on cleared browsers).
- No password accounts.
