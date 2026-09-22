# Figma → Klaviyo Production Pipeline

## Commands
- Install: `pnpm install --frozen-lockfile`
- Lint/format: `pnpm lint` (`pnpm lint:fix` to autofix)
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Regenerate JSON Schema after touching `packages/contracts`: `pnpm schema:generate`

## Read before architectural, security or API work
`claude/ai-software-development-best-practices.md` — fact-checked Figma and
Klaviyo API detail (rate limits, expiry windows, hard caps) plus a
do-not-cite appendix. Never restate a number from it from memory; check the
doc. Current plan: `claude/build-plan.md`. Current state:
`claude/m0-m1-status.md`. Settled decisions with rejected alternatives:
`docs/adr/`.

## Settled — do not re-litigate (see ADRs 0001–0002)
- Compiler, not generator. Figma nodes → typed DesignIR → MJML/Klaviyo
  `definition`. Same design must produce byte-identical output every run.
- The LLM's only job is component-level semantic classification, intent
  extraction from layer names, degradation decisions and alt text. It emits
  small structured `MappingRule` objects into a content-addressed cache keyed
  by Figma `componentId`. It never emits markup, HTML, geometry, colour
  values or the `definition` object.
- `SYSTEM_DRAGGABLE` is the primary output; `CODE` is an explicit fallback,
  and the UI must say which one a design produced.
- Design-file linting is a feature. Failures read "fix your Figma file", not
  "wrong email".
- The pipeline terminates at draft. Sending is always a human action.

If you think one of these is wrong, argue it. Do not silently build
something else.

## Invariants
- Never hardcode a Klaviyo API key, write one into config, or let one reach a
  log or a trace. One key per client, least privilege, secrets manager.
- Never write to a production Klaviyo account from a development or test
  path. Staging by default; production writes require the explicit guard.
- Every cache key carries the `tenant_id` prefix. `cacheKey()` takes a
  branded `TenantId` — do not route around it.
- Never ship a `figma.com` URL into an email. Re-host, content-addressed.
- Klaviyo merge tags (`{{ }}`, `{% %}`) are case-sensitive and must never be
  HTML-entity-encoded, URL-encoded in an `href`, or minified across.
- Store the current template payload before any `PATCH`. Rollback is stored,
  not computed.
- Never edit CI config as an incidental part of another change.
- `tests/` and `.github/` are agent-no-write; the guard is enforced in CI.

## How to work
- Explore → plan → implement → verify → commit. State the exact command you
  ran and paste real output. "Looks correct" is not verification.
- One context window, one reviewable PR. If you cannot name the files it
  touches, split it.
- Before anything non-trivial: interview me on edge cases and trade-offs,
  write a 1–2 page spec with non-goals, acceptance criteria as concrete
  input/output pairs, and contracts as Zod types. Execute it in a fresh
  session.
- Never loosen an assertion, skip a case, bulk-update snapshots, or swap a
  real call for a mock to make a suite pass. Flag it.
- If I have corrected the same issue twice, stop and ask for a restart.

## Output
British English. Direct, no preamble. Show the diff and the reasoning. Flag
uncertainty explicitly — do not state an API limit from memory.
