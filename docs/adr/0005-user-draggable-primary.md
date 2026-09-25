# ADR 0005 — `USER_DRAGGABLE` is the primary output, not `SYSTEM_DRAGGABLE`

**Status:** Accepted — supersedes [ADR 0002](0002-system-draggable-primary.md)

## Context

ADR 0002 picked `SYSTEM_DRAGGABLE` (native drag-and-drop, backed by a
structured `definition` object) as the primary output, on the reasoning that
only it satisfies both "1:1 with working images and links" and "the client's
marketing team can edit it afterwards."

Validating `DesignIR` against a real client file (Strongway Gym, see
`claude/build-plan.md`'s reference design) surfaced a concrete problem: the
footer's legal copy carries a link on one word in the middle of a sentence
(`Unsubscribe`, via Figma's `styleOverrideTable`) — exactly the mechanism
Klaviyo's `{% unsubscribe %}` merge tag needs to sit on. `SYSTEM_DRAGGABLE`'s
`definition` object has no `html` field at all, and neither Klaviyo's docs
nor our own reference doc confirm whether its block model can represent an
inline, partial-run link like this. Guessing at an undocumented proprietary
JSON shape to solve this was the wrong direction.

Separately, the actual editing requirement was clarified as narrower than
"full drag-and-drop": the client's marketing team needs to **add links and
make small text changes** in Klaviyo's UI — not rearrange blocks or restructure
layout.

## Decision

Target `USER_DRAGGABLE` as the primary output: hand-written HTML (full
control — our own tables, MSO conditionals, dark-mode handling, exactly per
`claude/ai-software-development-best-practices.md` §12) with specific
regions marked editable via `data-klaviyo-region`, containing
`klaviyo-text-block` / `klaviyo-image-block` elements. Because editable
content is literal HTML, an inline link on one word is just an `<a>` tag —
the problem that motivated this change doesn't exist here, by construction,
rather than by verifying an undocumented format.

`CODE` remains the fallback for anything that needs no editable surface at
all. `SYSTEM_DRAGGABLE` is dropped from the plan, not merely deprioritised —
we are not carrying its `column_layout` enum or block-level constraints
forward.

## Rejected alternative: keep `SYSTEM_DRAGGABLE` and extend `Block.Text` to prove Klaviyo supports it

Considered: spend a cycle creating a test DND template via the API with a
rich-text run to empirically confirm Klaviyo's block model, then extend
`Block.Text` to match whatever that turned out to be. Rejected because even
if confirmed, it buys nothing over `USER_DRAGGABLE` — we would still be
constrained to DND's `column_layout` enum and lose direct control over the
HTML, for no gain now that "full block-level rearrangement" is not actually
the requirement.

## Consequences

- `Block.Text` changes from `{ text: string }` to `{ runs: TextRun[] }`,
  where a `TextRun` is `{ text, href? }` — a run is one contiguous span,
  optionally linked. This is the M1 contract fix that unblocks this ADR;
  see `packages/contracts/src/design-ir.ts`.
- `packages/klaviyo-writer` (M7) and the `definition` emitter (M8 in
  `build-plan.md`) both change scope: M8 becomes "emit HTML with
  `data-klaviyo-region` markers," not "emit a DND `definition` object."
  `build-plan.md` needs updating to match — tracked as a follow-up, not
  done in this ADR.
- Which blocks become editable regions (all `Text`/`Button` blocks? a
  `MappingRule`-level decision per component?) is an open question for
  whichever milestone builds the Transform stage (M5) — not decided here.
- The `COLUMN_LAYOUTS` verification task ADR 0002 assigned to M8 is now
  moot; there is no Klaviyo-side enum to verify against.
