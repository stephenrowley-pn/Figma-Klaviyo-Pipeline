# `tests/` is agent-no-write

Enforced by `.github/CODEOWNERS` and by `scripts/guard-protected-paths.ts` in
CI, which fails any commit carrying an AI co-author trailer that touches this
directory (see `AGENTS.md`).

**Documented exceptions**, each expected to trip the CI guard by design and
merge via an admin bypass — none have yet had the adversarial human read
`AGENTS.md` requires for agent-authored test changes:

1. The tests under `contracts/` landed in the M0+M1 bootstrap commit,
   written by the agent that scaffolded the repository, before the guard
   existed to prevent it. See `claude/m0-m1-status.md`.
2. `tests/contracts/design-ir.test.ts` was updated when `Block.Text` changed
   from a flat string to `runs: TextRun[]` (see ADR 0005) — a schema-shape
   change necessarily requires its tests to change with it. New assertions
   were added for the specific case that motivated the change (a link on
   one run inside a paragraph); nothing existing was loosened or removed.

Delete this file once both have had that review. Any further test change
made by an agent needs the same explicit call-out here, not a silent add.
