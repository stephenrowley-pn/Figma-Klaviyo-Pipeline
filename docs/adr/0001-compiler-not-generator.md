# ADR 0001 — Compiler, not generator

**Status:** Accepted

## Context

The pipeline turns a Figma design into a Klaviyo email template. The most
direct approach is to hand the design (or a description of it) to an LLM and
ask it to emit HTML or a Klaviyo `definition` directly.

## Decision

Treat this as a compiler problem: `Figma node tree → typed DesignIR →
MJML/Klaviyo definition`, via deterministic, pure transform functions. The
LLM is used only at the Resolve stage, at component granularity, to emit
small structured `MappingRule` objects — never markup, geometry, colour
values, or the `definition` object itself. The same `(DesignIR,
MappingRule[], transform_version)` must produce byte-identical output on
every run.

## Rejected alternative: LLM emits markup/definition directly

Rejected because it forfeits the one property that matters most for a
production pipeline writing to live client marketing accounts:
reproducibility. Every run becomes a coin flip, every regression becomes
prompt archaeology, and two runs of the same design cannot be diffed
meaningfully. The supporting evidence (see
`claude/ai-software-development-best-practices.md` §9) is a 2026
"compile once, execute forever" paper showing break-even against per-run LLM
calls at roughly 17 transactions, and at 1,000 transactions, 57× fewer
tokens, ~450× lower latency, and 100% reproducibility versus 95%. That is the
shape of this problem: one design system, many emails.

## Consequences

- The Resolve stage's output must be cacheable and content-addressed by
  Figma `componentId` — the second email using the same design system costs
  zero LLM calls.
- `MappingRule` must be structurally incapable of carrying markup, colour, or
  geometry, so a schema violation catches an attempt to route around this
  decision.
- Everything downstream of Resolve (Transform, Validate, Publish) must be
  pure and side-effect free, and is testable with property-based tests
  (round-trip, idempotency) rather than golden-output comparison alone.
