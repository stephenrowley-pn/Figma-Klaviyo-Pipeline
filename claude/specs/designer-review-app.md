# Spec — Designer review app (Figma plugin + Vercel web app)

**Status:** Approved with decisions below, 25 September 2026. Execute in a fresh session.
**Owner:** Stephen Rowley. **Users:** the Public Nectar design team.
**Evidence:** `prototypes/figma-eval/` (99.63% on the Strongway reference, read back from Klaviyo).

## Decisions (25 September 2026)

| Question | Decision |
| --- | --- |
| Replace the "no multi-client UI" non-goal / reshape M9 | **Approved** |
| Downgrade `frame/missing-auto-layout` and `layout/overlapping-elements` | **Approved** — warnings, except overlap that hides live text stays an error |
| Sign-in | **Google Workspace SSO** (via Supabase Auth) |
| Who can "Send to Klaviyo draft" | Any signed-in designer (default; staging only, never sends) |
| Plugin vs web app | **Web app first**; plugin later, once the org Figma plan is in place |
| Storage | **Supabase** (Postgres + Storage), existing Public Nectar account |
| Link convention | Pending — owner to share |

## Changes to settled plan (approved above)

1. `claude/build-plan.md` lists "a multi-client UI" as a v1 non-goal and M9 as a small approval
   console. This spec replaces both with a designer-facing plugin + web app. **Needs explicit sign-off.**
2. Lint rules `frame/missing-auto-layout` and `layout/overlapping-elements` would reject the
   reference frame, which is absolutely positioned throughout and overlaps by design (banner on
   diagram, cards on photo). The prototype shows absolute layout compiles faithfully. Proposal:
   downgrade both to warnings for frames the transform can place; keep them as errors only where
   overlap hides live text.

## Problem

Today a Figma frame becomes a Klaviyo draft only with an engineer (or an agent) driving each step.
Designers cannot see what the pipeline understood, why it failed, or how close the result is.

## User flow

1. Designer selects a frame in Figma → plugin **Check**.
2. Plugin sends the frame's node tree to the backend (no Figma PAT needed on this path).
3. Within the plugin: lint findings, and every node the pipeline classified (heading, body, button,
   tile, image, legal…) highlighted on canvas. Clicking a finding selects the node.
4. **Open report** → web app: eval scores (overall, per section, per node), Figma | email | diff
   side-by-side, the same classification overlay, each block's source (`rule` / `cache` / `llm` /
   `human`), and its link.
5. Designer can correct a classification (e.g. tile → button). Stored as a `human_edited`
   `MappingRule`; the next run uses it.
6. **Send to Klaviyo draft** (disabled while any `error` finding exists) → upload to the client's
   **staging** account → read back → re-run the eval on Klaviyo's stored *and* rendered HTML → show
   that score. Never sends.

## Architecture

| Piece | Where | Notes |
| --- | --- | --- |
| `apps/web` | Next.js on Vercel | UI + API routes. Holds Klaviyo keys server-side only. |
| `apps/figma-plugin` | Figma Plugin API | Reads nodes, highlights, posts to `apps/web`. Holds no secrets. |
| Eval worker | Headless Chromium | Vercel function size/time limits for Chromium are **unverified** — spike first; fallback is a separate container worker the web app calls. |
| Pipeline packages | `packages/*` (M2–M8) | Rebuilt from the prototype as typed, tested modules. |
| Storage | Supabase | Postgres: run records, rule cache (tenant-prefixed via `cacheKey()`), image hash → Klaviyo URL, rollback payloads, client config. Storage: eval PNGs. Klaviyo keys stay in the secrets manager, not the database. |

## Determinism and token cost

The model is called only to classify a Figma component it has not seen, and only when rules
cannot decide. Order: (1) cached `MappingRule` by `componentId`; (2) deterministic heuristics
(component named `Button`/`CTA`, single text on a filled rect, `hyperlink` present, etc.);
(3) LLM, result cached as `provenance: "llm"` (still requires `approvedBy` per M1). Every run
records `llmCalls`. Target: a re-run of a frame whose components are all known makes **zero** calls.

## Contracts (new; reuse `LintFinding`, `MappingRule`, `RunRecord`, `TenantId` from M1)

```ts
const BlockRoleSchema = z.enum([
  "logo", "heading", "body", "button", "tile", "image", "background", "legal", "divider",
]);

const ClassifiedBlockSchema = z.object({
  figmaNodeId: z.string().min(1),
  role: BlockRoleSchema,
  source: z.enum(["rule", "cache", "llm", "human"]),
  ruleId: z.string().min(1).optional(),   // heuristic or MappingRule that decided it
  href: z.string().min(1).nullable(),     // OutboundUrl or an allow-listed merge tag
  editable: z.boolean(),                  // emitted inside a data-klaviyo-region
}).strict();

const EvalTargetSchema = z.enum(["local-sim", "klaviyo-stored", "klaviyo-rendered"]);

const EvalReportSchema = z.object({
  target: EvalTargetSchema,
  thresholds: z.object({ overall: z.number(), section: z.number(), node: z.number(), offsetPx: z.number() }).strict(),
  overallPct: z.number().min(0).max(100),
  heightPx: z.number(), referenceHeightPx: z.number(),
  sections: z.array(z.object({ name: z.string(), y0: z.number(), y1: z.number(), pct: z.number(), pass: z.boolean() }).strict()),
  nodes: z.array(z.object({
    figmaNodeId: z.string(), pct: z.number(), dx: z.number(), dy: z.number(),
    issues: z.array(z.string()), pass: z.boolean(),
  }).strict()),
  pass: z.boolean(),
}).strict();

const ReviewRunSchema = z.object({
  run: RunRecordSchema,                    // existing M1 contract
  figmaFileKey: z.string(), figmaNodeId: z.string(),
  status: z.enum(["checking", "blocked", "ready", "sending", "drafted", "failed"]),
  lint: z.array(LintFindingSchema),
  blocks: z.array(ClassifiedBlockSchema),
  evals: z.array(EvalReportSchema),
  klaviyoTemplateId: z.string().optional(),
  llmCalls: z.number().int().nonnegative(),
}).strict();
```

## Acceptance criteria

| # | Input | Expected output |
| --- | --- | --- |
| 1 | Strongway frame `8485:12367`, links added in Figma | `klaviyo-rendered` eval: overall ≥ 99.0, every section ≥ 97, all nodes pass, height 3896 |
| 2 | Same frame, second run, unchanged | Byte-identical HTML; `llmCalls` 0; zero Klaviyo writes |
| 3 | Strongway frame as it is today (buttons have no link) | `cta/missing-link` error per button, naming the label; **Send** disabled |
| 4 | Blank `#080808` 600×3896 frame | Eval fails (prototype: 54.05%) |
| 5 | Reference with one section shifted 3px | Eval fails (prototype: 98.25%, 14/35 nodes) |
| 6 | Designer changes a tile from `tile` to `button` | `human_edited` rule stored under the tenant prefix; next run shows `source: "human"` |
| 7 | Black-on-black social icons in the footer | `node/invisible` warning (new lint code) |
| 8 | Network capture of plugin + browser during a full run | No Klaviyo key, no Figma PAT in any request or response |
| 9 | Any run | No `figma.com` URL in output HTML; merge tags unencoded; only `{% unsubscribe_link %}`-style tags that Klaviyo's render API accepts |

## Non-goals (v1)

Sending. Production Klaviyo writes. Editing designs from the plugin (highlight only). Mobile
layouts (separate milestone; output is fixed 600px today). Gmail/Outlook screenshot testing
(Litmus/Email on Acid later). Best-effort output for files that fail lint. Anyone outside Public
Nectar.

## Build order

A. Rebuild the prototype as packages (M2 figma-client → M3 normalise → M4 lint → M5 transform →
M6 validate → M7/M8 writer + regions), with the Strongway frame as the golden fixture and a CLI.
B. Eval worker spike (Chromium on Vercel vs container). C. `apps/web` report + send, Supabase
schema and Google SSO. D. `apps/figma-plugin` (after the org Figma plan). E. Heuristic classifier, then LLM fallback (M10).

## Open questions

1. Link source convention for designers (owner to share): Figma hyperlink on the text
   (recommended) vs layer-name suffix vs campaign sheet.
2. Which clients after Strongway, and does each have a separate staging Klaviyo account?
3. Eval worker: Chromium on Vercel or a container (resolved by the build-order step B spike).
