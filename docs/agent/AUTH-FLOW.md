# Admin auth flow — plan (TanStack SPA, bearer sessions)

Status: guard fix shipped (`748d9c3`); the rest is sequenced below.
Read with `apps/admin/src/routes/_admin.tsx`, `lib/auth.ts`, `lib/api.ts`,
`lib/use-api-query.ts`.

## What was wrong

Two session-destroyers, both fixed or scoped in `748d9c3`:

1. **The gate wiped on any non-OK.** `beforeLoad` awaited `/auth/me` on every
   navigation and called `clearSession()` on anything but OK — including a
   network error, a 500, or a slow first query. The clear propagated to every
   open tab via the `storage` event. Net effect: an API blip during a click
   logged the operator out everywhere. Fixed: the gate decides on the stored
   session alone; re-validation runs in the background and narrows only.
2. **Echo 401s after sign-out.** In-flight queries fired in the same commit as
   a sign-out go out tokenless, get the 401 they asked for, and the global
   handler re-fired the leave. Scoped: the handler now checks storage first —
   a 401 with no stored session is an echo, not a revocation.

What was NOT wrong: the token itself (API answers 200 five-for-five), the
30-day expiry timer (clamp-and-rearm, `d386fea`), concurrent calls, or rate
limits.

## The model (keep)

- Bearer token in memory + localStorage mirror. No httpOnly cookie is
  possible: TanStack Start serves this console as a static SPA, no server.
  The mirror is readable by page scripts — accepted cost, contained by: no
  untrusted HTML rendered anywhere, stored sessions die at expiry, every
  data call re-authorises server-side.
- One rule for session destruction: **only a real API answer proves a
  session is dead.** Storage reads never destroy; only a 401-while-stored
  or a confirmed demotion clears.
- Role gates are cosmetic. `RolesGuard` decides; the console only hides
  buttons that would bounce. `auth/me` returns `{id, email, role}` — no
  display name; email local-part is the shown name until the API grows one.

## Sequenced next (in order, each its own commit)

1. **`DELETE /settings/flags/:key` contract entry** (5 min). Relay hand-rolls
   it via raw fetch because the registry has no 204-body key. Register the
   shape or bless the convention in `packages/contracts` + Keystone follow-up.
2. **Refresh or short-TTL rotation** (needs API design). 30-day bearer in
   readable storage is the widest window here. Options: sliding refresh on
   `/auth/me` success (server re-mints with new expiry), or a short access
   TTL + silent `/auth/refresh` with httpOnly-feasible same-origin cookie
   once the console deploys same-origin with the API. Do NOT shorten the
   TTL without the rotation endpoint — that just signs operators out more.
3. **Step-up or dual-control for destructive writes** (product call). Today a
   stolen token can suspend users, flip flags, run jobs. Candidates: reason
   floor already exists (8 chars); add per-action confirm showing blast
   radius (done in dialogs) + optional second-operator approve for
   `owner`-tier writes (fee rules, provider status). Needs `BE` task + schema.
4. **Session inventory** (needs API). "Sign out other sessions" and a
   last-seen list per account: `GET /auth/sessions`, `DELETE
   /auth/sessions/:id`. Backend gap, not console work.
5. **CSP nonce + Trusted Types** (deploy host). The meta-tag CSP is interim;
   the host must send header CSP with a nonce and the console must stop
   `'unsafe-inline'`. Blocks stored-XSS escalation into token theft.

## Non-goals (do not build)

- httpOnly cookies in the SPA as served today — no server to set them.
- Client-side "is the token valid" checks beyond expiry date — the API is
  the authority; the console renders, it does not judge.
- Shortening TTL as a security gesture without rotation — pain, not safety.
- Per-tab sessions — tried (`sessionStorage`), rejected: tabs disagree.
