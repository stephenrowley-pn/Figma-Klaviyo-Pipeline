# ADR 0004 — Supply-chain gates and known gaps

**Status:** Accepted

## Context

`claude/ai-software-development-best-practices.md` §7 documents that AI
coding assistants hallucinate package references at a measured 4.6–19.7%
depending on model, that hallucinated names recur (~43%) and are therefore
registrable and weaponisable, and that AI-suggested dependency *upgrades*
point to non-existent, deprecated, or unsafe versions 27.8% of the time. None
of this is caught by a compiler. Separately, this repository will eventually
hold client Klaviyo API keys and write to live marketing accounts, which
raises the cost of a supply-chain compromise well above a typical internal
tool.

## Decision

Blocking CI gates (`.github/workflows/ci.yml`), none of which merely
comment:

- Formatter and linter (Biome) — auto-fixable, zero false positives.
- Strict-mode TypeScript (`noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- Generated JSON Schema staleness check.
- Tests (Vitest).
- Secret scanning (gitleaks) — repo contents; scanning agent transcripts and
  traces separately is a known gap, see below.
- `pnpm audit --audit-level=high`.
- Dependency licence allowlist (`scripts/check-licenses.ts`).

Supply-chain hardening beyond CI: exact version pins (`save-exact=true`),
`pnpm install --frozen-lockfile` in CI, postinstall scripts off by default
(`ignore-scripts=true`), and a 3-day cooldown on newly published dependency
versions (`minimum-release-age=4320` minutes) so a same-day malicious
publish cannot land via a routine bump.

## Rejected alternative: advisory-only gates ("comment, don't block")

Rejected on the evidence in §6: one dataset found 71.8% of flagged PRs ship
with at least one open critical flag, and 60–64% of security/critical flags
merge unaddressed, when detection does not gate. Detection is cheap;
enforcement is the actual gap, so gates that only comment reproduce exactly
that failure mode.

The licence allowlist tolerates `MPL-2.0` (weak copyleft, file-level) for
build/dev tooling only — it appears via Biome's own dependency tree
(`lightningcss`), never in anything bundled into a shipped artefact. A
compound SPDX expression (`MIT OR Apache-2.0`) is accepted if any option in
it is allowed.

## Known gaps, not yet closed

- **Snippet-level licence scanning is absent.** `check-licenses.ts` covers
  declared dependency licences only, not copy-pasted code. Needed before any
  client delivery.
- **Secret scanning does not cover agent transcripts/traces**, which are a
  leak surface repo scanners do not reach.
- **`OutboundUrlSchema` denies the `figma.com` hostname only**, not Figma's
  S3 render hosts — tracked for M2, see `packages/contracts/src/outbound-url.ts`.
- **No sandboxed/default-deny-egress execution boundary yet** for agent
  sessions working in this repo — the highest-value control per §7, deferred
  pending an environment decision.
