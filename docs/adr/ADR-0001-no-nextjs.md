# ADR-0001 — No Next.js (and no Redis, R2, public gallery, AI tutor, WebSerial flashing, or classroom dashboard in MVP+)

**Status:** Accepted

## Context

Pinboard is a client-heavy block editor. SSR offers no benefit to a Blockly/CodeMirror workspace, and a Next.js migration carries a real tax on the existing React + Vite codebase.

## Decision

Stay on React + Vite + React Router. The app builds to static output deployable to Vercel (all non-API paths rewrite to `index.html`). Also out of scope for MVP+: Redis, Cloudflare R2, a public gallery, an AI tutor, WebSerial flashing, and a teacher/classroom dashboard.

## Consequences

- No server routes; the OAuth callback is a client route (`/auth/callback`, see `docs/domains/supabase.md`).
- Anything needing a real backend (live compile) must be an external worker (ADR-0008/0009).
- Scope stays on the learning loop; the non-goals list in `docs/ARCHITECTURE.md` §5 is enforceable in review.
