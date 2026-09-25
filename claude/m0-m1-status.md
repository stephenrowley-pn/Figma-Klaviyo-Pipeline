# M0 + M1 — status and open items

**Date:** 22 September 2026
**Branch:** `claude/wizardly-meitner-787rde`.

**Post-M1 correction (25 September 2026, see ADR 0005):** validating
`DesignIR` against a real client file (Strongway Gym) surfaced that
`Block.Text` couldn't represent a link on one word inside a paragraph — the
exact shape an unsubscribe link needs. `Block.Text` changed from
`{ text: string }` to `{ runs: TextRun[] }`, `TextRun` being
`{ text, href? }`. Same change also dropped `SYSTEM_DRAGGABLE` as the
primary output in favour of `USER_DRAGGABLE`. The four-contracts and
six-fixtures description below is otherwise unchanged and still accurate.

**Note on provenance:** an earlier claude.ai project session did this same
M0+M1 work and described it in this file, but delivered it as a git bundle
because that session's repo access wasn't authorised — the bundle was never
attached anywhere this session could read it, and the repository itself was
empty (no commits, on `origin` or locally) when this session started. That
work is not recoverable; everything below was rebuilt from scratch in this
session, following `claude/build-plan.md` and the (then-unmerged)
`AGENTS-addendum.md`, which is why some specifics (file layout, test count)
differ from what the earlier session reported.

## What landed

**M0.** pnpm workspace, TypeScript 7.0.2 strict (`exactOptionalPropertyTypes`,
`verbatimModuleSyntax`, plus the full `strict` family —
`noPropertyAccessFromIndexSignature` was tried and dropped: it fights
Biome's `useLiteralKeys` rule for no safety gain once `noUncheckedIndexedAccess`
is already on), Biome 2.5.14, Vitest 5.0.1. Blocking CI gates (`.github/workflows/ci.yml`):
format, lint, strict typecheck, generated-schema staleness, tests, gitleaks,
`pnpm audit --audit-level=high`, licence allowlist (`scripts/check-licenses.ts`,
tolerates `MPL-2.0` for dev tooling only and compound `X OR Y` SPDX
expressions). Supply chain: exact pins (`save-exact=true`), frozen lockfile
in CI, postinstall scripts off (`ignore-scripts=true`), 3-day release
cooldown (`minimum-release-age=4320`) — this genuinely blocked `pnpm install`
on first run for versions of `tsx`/`@types/node` published within the
cooldown window; resolved by pinning to versions old enough. `AGENTS.md` is
65 lines.

Agent write ban on `tests/` and `.github/` enforced twice — `.github/CODEOWNERS`,
and `scripts/guard-protected-paths.ts` in CI, which fails any commit in the
PR's range carrying an AI co-author trailer that touches those paths. This
bootstrap commit is the documented exception (see `tests/README.md`) and is
expected to trip the guard; it isn't exercised meaningfully until there's a
base branch to diff against.

Also landed, ahead of the M0/M1 split in `build-plan.md` (kept small,
directly supports ADR 0003): `infra/secret-provider.ts` — the
`SecretProvider` interface, an `EnvSecretProvider` for local dev, and a
`RefusingSecretProvider` that is the production default until a real
secrets manager is wired in.

**M1.** `DesignIR`, `MappingRule`, `LintFinding`, `RunRecord` as strict Zod
schemas (`packages/contracts/src/`), JSON Schema generated from them (Zod
4.6.5's native `z.toJSONSchema`, no extra dependency — refinements
(`.refine()`) don't export, so `MappingRuleShape`/`RunRecordShape` are the
pre-refinement shapes used only for schema generation), six handwritten
`MappingRule` fixtures (`packages/contracts/fixtures/mapping-rules/`), and
the tenant-scoped cache key helper.

Structural enforcement worth knowing about:

- `cacheKey()` takes a branded `TenantId`, so a missing tenant prefix is a
  type error, not a review miss.
- `MappingRule` has no field capable of holding a colour, pixel value, HTML
  string or `definition` fragment, and every object is `.strict()` —
  smuggling one is a parse failure.
- `mayWriteToProduction()` requires the guard's `tenantId` and `contentHash`
  to match the request; it returns `false` rather than throwing, so callers
  handle the negative case explicitly.
- `Secret` hides its value behind `.expose()` and overrides `toString`,
  `toJSON` and Node's inspect symbol, so structured logging and span
  attributes cannot reach it.
- Lint copy lives in one catalogue (`lint-copy.ts`) and is asserted free of
  pipeline vocabulary (`DesignIR`, `componentId`, `pipeline`, `schema`,
  `Zod`, `IR`, `transform`, `backend`, `MappingRule`, `figmaNodeId`).

48 tests pass across 11 files (`pnpm test`). Four deliberate mutations were
made and reverted to confirm the tests actually catch them, mirroring what
the earlier session reported: dropping the tenant prefix from `cacheKey()`,
dropping the content-hash check from `mayWriteToProduction()`, removing
`.strict()` from `MappingRuleSchema`, and removing the refine that rejects
an unapproved `llm`-provenance rule. Each produced a real test failure; all
four were reverted and the suite confirmed green again immediately after.

## Decisions taken

- **ADR 0001 — compiler, not generator.**
- **ADR 0002 — `SYSTEM_DRAGGABLE` is the primary output, `CODE` the fallback.**
- **ADR 0003 — runtime secrets do not live in GitHub.** GitHub Actions
  secrets cannot be read back and are only materialised inside a workflow
  run, so they serve CI-time secrets only. Runtime secrets go through
  `SecretProvider`, deferred behind an interface with an env implementation
  for dev and a refusing implementation for production. Choosing the real
  provider is a one-file change and blocks M7, not M0–M6.
- **ADR 0004 — supply-chain gates and known gaps**, including the licence
  allowlist's `MPL-2.0` tolerance and the gaps listed below.

## Open items, in the order they bite

1. **Branch protection / CODEOWNERS review.** `tests/` is agent-authored in
   this bootstrap commit and has not had the adversarial human read
   `AGENTS.md` requires. `tests/README.md` carries the exception and should
   be deleted once that review has happened.
2. **`COLUMN_LAYOUTS` is unverified.** Our working vocabulary
   (`packages/contracts/src/design-ir.ts`), not a quoted Klaviyo enum.
   Confirm at M8 by writing a DND template and reading it back with
   `additional-fields[template]=definition`; bump the ruleset version if it
   differs.
3. **`OutboundUrlSchema` does not catch Figma's S3 render hosts.** The
   hostname rule covers `figma.com` only. The test
   (`tests/contracts/outbound-url.test.ts`) asserts the real gap rather than
   hiding it. Add the S3 hosts to the deny list at M2.
4. **Snippet-level licence scanning absent.** Dependency licences only.
   Needed before any client delivery.
5. **Secret scanning does not cover agent transcripts/traces.**
6. **No sandboxed/default-deny-egress execution boundary** for agent
   sessions working in this repo.
7. **Open question 4 (build-plan.md)** — nominate the reference design
   (client, file, frame) before M3. The fixtures use placeholder component
   ids.
8. **Open question 7 (build-plan.md)** — a staging Klaviyo account separate
   from every client production account. M7 cannot start without it.
