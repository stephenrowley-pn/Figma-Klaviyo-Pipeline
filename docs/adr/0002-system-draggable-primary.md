# ADR 0002 — `SYSTEM_DRAGGABLE` is the primary output, `CODE` is the fallback

**Status:** Superseded by [ADR 0005](0005-user-draggable-primary.md)

This ADR's reasoning (only DND satisfies both "1:1 fidelity" and "editable
afterwards") turned out to rest on an unstated assumption: that
`SYSTEM_DRAGGABLE`'s block model can represent everything the design needs,
including an inline link on one word inside a paragraph. Validating the IR
against a real client file surfaced a concrete case (an unsubscribe link
inside a footer sentence) where our own `Block.Text` couldn't carry that,
and Klaviyo's DND rich-text format for it was never actually confirmed. See
ADR 0005 for the replacement decision. Left in place, unedited below, as the
record of what was decided and why — including the two once-rejected
alternatives, one of which we now use.

## Context

Klaviyo templates come in three editor types: `CODE` (custom HTML, exact
fidelity, not editable by marketers afterwards), `USER_DRAGGABLE` (hand-written
HTML with explicitly marked editable regions), and `SYSTEM_DRAGGABLE` (native
drag-and-drop, backed by a structured `definition` object, no `html` field at
all). Programmatic drag-and-drop template creation went GA in API revision
`2026-04-15`.

The actual business requirement is "1:1 with working images and links" *and*
"the client's marketing team can edit it afterwards". Only one editor type
satisfies both.

## Decision

Target `SYSTEM_DRAGGABLE` as the primary output. Build the Figma extractor
and lint gate around a constrained design system — 600px canvas, an
enumerated `column_layout` vocabulary, block-level primitives — so the
mapping into the DND block/section/row/column model is lossless *by
construction*, rather than attempted and sometimes failing. `CODE` is an
explicit, declared fallback for designs the mapper cannot represent as DND,
and the UI must say which one a given design produced. An `html` block inside
a DND template is the escape hatch for one-off fragments — used sparingly,
since over-using it recreates the CODE problem in miniature.

## Rejected alternative: `CODE` as the primary output

Rejected because it fails the "editable afterwards" half of the requirement:
a marketer who wants to change a headline or swap an image in a `CODE`
template is editing raw HTML. `USER_DRAGGABLE` was also considered and
rejected — its editable regions are coarser than DND's block model and it
still requires hand-written HTML as the base, which reintroduces most of
`CODE`'s fidelity-maintenance burden.

## Consequences

- A design with overlapping elements, absolute positioning, rotation, or
  non-standard column ratios cannot be reproduced exactly in DND. The design
  linter (M4) must catch these at the Figma-file stage, before extraction,
  with designer-readable findings.
- `COLUMN_LAYOUTS` is our own working vocabulary, not a quoted Klaviyo enum,
  and must be verified empirically at M8 by writing a DND template and
  reading it back with `additional-fields[template]=definition`.
- The DND/CODE ratio should be tracked as a product metric from M8 onward —
  if `SYSTEM_DRAGGABLE` cannot express most client designs in practice, this
  decision needs revisiting.
