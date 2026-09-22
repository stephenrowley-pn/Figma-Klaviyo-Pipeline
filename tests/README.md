# `tests/` is agent-no-write

Enforced by `.github/CODEOWNERS` and by `scripts/guard-protected-paths.ts` in
CI, which fails any commit carrying an AI co-author trailer that touches this
directory (see `AGENTS.md`).

**Documented exception:** the tests under `contracts/` landed in the M0+M1
bootstrap commit, written by the agent that scaffolded the repository, before
the guard existed to prevent it. They have not yet had the adversarial human
read that `AGENTS.md` requires for agent-authored test changes. The bootstrap
PR is expected to trip the CI guard by design and merges via an admin bypass,
once — see `claude/m0-m1-status.md`.

Delete this file once that review has happened.
