# Build Plan — Figma → Klaviyo Production Pipeline

**Date:** 21 September 2026
**Canonical, editable version:** https://claude.ai/code/artifact/e9351425-a2c2-4570-a6b9-d67f09d4737d
This file is the copy a fresh session should read. If the two disagree, the living doc wins.

**Post-M1 update (see ADR 0005):** the primary output changed from
`SYSTEM_DRAGGABLE` to `USER_DRAGGABLE` after validating `DesignIR` against a
real client file surfaced an inline-link case the DND block model was never
confirmed to support. Every `SYSTEM_DRAGGABLE`/`definition` reference below
is superseded by that ADR; this file hasn't been fully rewritten to match
yet, and neither has the canonical artifact above.

**Proposed direction (25 Sep 2026, awaiting sign-off):** a designer-facing Figma
plugin + Vercel web app replaces the "no multi-client UI" non-goal and reshapes
M9 — see `claude/specs/designer-review-app.md`.

---

## Definition of done (v1)

One linted Figma frame becomes a `USER_DRAGGABLE` Klaviyo template in a
**staging** account, with a draft campaign and a proof sent — and a second run
of the same unchanged frame produces byte-identical HTML and performs
**zero** writes.

### Non-goals for v1

Sending (permanently out of scope). Flows, forms, segments, catalogues, SMS,
push. Arbitrary Figma files — unlinted files are rejected with findings, not
best-efforted. `SYSTEM_DRAGGABLE` (see ADR 0005). Litmus/Email on Acid Tier 3
screenshots. Figma Variables (Enterprise-only REST API). A multi-client UI.
Template garbage collection.

Designed for from M1 even though unused in v1: `tenant_id` on every cache key,
per-client keys, and `(run_id, target_object, field_hash)` idempotency keys.

---

## Pipeline

```
Ingest → Normalise→DesignIR → Lint gate → Resolve (LLM) ⇄ Rule cache
       → Transform (pure) → Validate → Approve (durable) → Publish
```

Everything is deterministic except Resolve, which is skipped on a cache hit.
`Transform` is a pure function of `(DesignIR, MappingRule[], transform_version)`:
no network, no clock, no randomness.

**Departure from best-practices §16 build order:** the rule cache and a
handwritten `MappingRule` fixtures file land at M1, before any LLM exists, so
the transform consumes rules from day one and M10 only changes where rules come
from. Without this, M10 is a rewrite of the transform's input contract.

---

## Contracts frozen at M1

`DesignIR` (versioned, `Document → Section[] → Row → Column[] → Block[]`, every
block carrying `figma_node_id`, plus an `unresolved[]` list),
`MappingRule` (keyed on Figma `componentId` + `ir_shape_hash`, with
`provenance: handwritten | llm | human_edited`),
`LintFinding` (designer-readable `message` + `fix_hint` — a product surface,
reviewed as copy), and
`RunRecord` (pins `ir_version`, `ruleset_version`, `transform_version`,
`model_id`, `prompt_hash`, `figma_file_version`, `content_hash`, and the stored
`rollback_payload`).

Full Zod sketches are in the living doc.

---

## Milestones

| # | What lands | Owns | Merge gate |
| --- | --- | --- | --- |
| M0 | Repo, CI, sandbox, secrets. `AGENTS.md` <80 lines. Agent denied write access to `tests/` and CI config | `.github/`, `AGENTS.md`, `infra/` | Formatter, strict types, secret scan, SCA, licence scan all block merge |
| M1 | The four contracts + generated JSON Schema. Handwritten `MappingRule` fixtures | `packages/contracts/` | Schema round-trips; `tenant_id` on every cache-key helper |
| M2 | Figma client: node tree, styles, 2× exports. Token bucket. `/meta` polling | `packages/figma-client/` | Cassette tests pass; limiter proven against synthetic 429 + `Retry-After` |
| M3 | Normaliser → DesignIR. All three link channels. `characterStyleOverrides` short-array handling | `packages/normalise/` | Golden IR for 3 fixture frames; property test on link-range reconstruction |
| M4 | Design-file linter + findings UI copy | `packages/lint/` | A deliberately broken fixture produces the exact expected `LintFinding[]` |
| M5 | Transform: IR + rules → MJML → post-processed HTML. A11y + dark mode injected | `packages/transform/` | 100 runs, one hash. No I/O reachable from the module |
| M6 | Validation: Tier 1 static lint, Tier 2 pixel diff vs Figma, masked per `figma_node_id` | `packages/validate/` | Pinned browser; diff ratio ≤ 0.02 at 600px and 375px |
| M7 | Klaviyo writer: content-addressed images → `USER_DRAGGABLE` template → draft campaign → proof. Staging only, dry-run default | `packages/klaviyo-writer/` | Second run of unchanged input performs zero writes; rollback stored before any `PATCH` |
| M8 | `data-klaviyo-region` emitter marking which blocks are editable, `CODE` declared fallback for anything needing none, UI states which | `packages/klaviyo-regions/` | Write then read back, region markers survive Klaviyo's own save round-trip |
| M9 | Approval UI: three-up panes, field-level from/to diff, durable wait, re-validate on execute | `apps/console/` | Approval older than the live template's `updated` bounces to re-review |
| M10 | LLM resolve at component level, emitting `MappingRule` into the cache | `packages/resolve/` | Handwritten and LLM rules produce identical output on the reference design |
| M11 | Multi-tenant hardening + eval harness from real failures | `packages/gateway/`, `evals/` | A missing tenant prefix fails a test, not a review |

**Dependencies.** M1 blocks everything. M2→M3→M4 strictly serial. M5 needs M1+M3.
M6 needs M5. M7 and M8 need M5. M9 needs M7. M10 needs M1, M3 and M6 — M6
specifically, because without a pixel diff there is no way to measure what the
model adds. M11 last, but its contract surface was fixed at M1.

No date estimates. Milestone count is the honest unit.

---

## Verification commands (pasted output required in every PR)

| Invariant | Shape | Command |
| --- | --- | --- |
| Transform pure and deterministic | 100 runs → one hash | `pnpm test:property --filter transform` |
| IR ↔ HTML region markers round-trip | `parse ∘ serialise = id` | `pnpm test:property --filter region-roundtrip` |
| Publish idempotent | `publish ∘ publish = publish` | `pnpm test:integration --filter publish --env staging` |
| Link count in = out | Invariant vs Figma link map | `pnpm test --filter linkmap` |
| Merge tags survive generation | Golden byte comparison | `pnpm test:golden --filter mergetags` |
| Render matches Figma | Pixel diff masked per node | `pnpm test:visual --browser pinned` |
| Output accessible | Tier 1 static lint | `pnpm lint:email` |
| No secret in logs or traces | Transcript + trace scan | `pnpm scan:secrets --include-traces` |

Agent cannot write `tests/`, enforced at the filesystem and mirrored in CI.
Hidden compositional suite in CI only. Coverage is a ratchet floor, never a
target. Mutation score on `transform/` and `klaviyo-writer/` only. Test diffs
reviewed as a separate artefact. Comprehension artefact required on Tier 1/2 PRs.

---

## Top risks

1. ~~`SYSTEM_DRAGGABLE` cannot express the client's designs~~ — moot, see
   ADR 0005. Successor risk: `USER_DRAGGABLE` regions turn out coarser than
   the small-edit requirement needs, or Klaviyo's editor doesn't treat
   `klaviyo-text-block` content as rich text in practice. Verify at M8;
   track the `USER_DRAGGABLE`/`CODE` ratio as a product metric.
2. Real client Figma files fail the linter en masse → run the linter against
   real files at **M4**, before building anything downstream of it.
3. Klaviyo 1,000-template cap → update in place, mapping table on content hash,
   alert at 800.
4. Klaviyo image upload daily caps → content-addressed cache, `hash → url`,
   forever; prefer the file endpoint.
5. Figma image URL expiry → re-host everything; lint rule forbidding `figma.com`
   in any output.
6. Figma PAT 90-day max expiry → rotation designed in at M2.
7. Cross-tenant cache leak → `tenant_id` in the cache-key helper's type
   signature, not by convention.
8. Stale approval overwrites a client edit → re-read and re-diff at execute.

**Verified 25 Sep 2026 (render API, staging account):** `{% unsubscribe_link %}`
renders to Klaviyo's `[unsubscribe_tag]` URL and keeps the enclosing `<a>`'s
inline styles; `{% unsubscribe_url %}` is not a valid tag (400). Details in
`prototypes/figma-eval/README.md`. **Still unverified:** whether `{% unsubscribe %}` is actually
required. Also undocumented: any byte-size limit on template `html`; whether
Klaviyo sanitises `<style>` or media queries in `CODE` templates; the exact UTM
exclusion list; API revision support window.

---

## Open questions (assumed answers in brackets — block M1)

1. Language and runtime [TypeScript throughout].
2. Durable execution [Inngest; reversible until M7, not after].
3. Existing code? [greenfield].
4. The reference design — client, file, frame [nominated before M3].
5. Do we control the design system? [yes — if not, M4 becomes the largest milestone].
6. Figma plan tier per client — rate limit, Variables availability, Dev/Full seat.
7. Staging Klaviyo account separate from every client production account? [yes; M7 cannot start without it].
8. CDN for re-hosted images [Klaviyo's own hosting; revisit at M7 against the daily caps].
9. Secrets manager already in use at Public Nectar? [gates M0].
10. Where approval happens [small web console at M9].

**Next step:** M0 + M1 in one session — repo, gates, and the four contracts —
then stop and show the types before anything consumes them.
