# Figma → Klaviyo Production Pipeline

Turns a linted Figma frame into a `SYSTEM_DRAGGABLE` Klaviyo email template,
with a draft campaign and a proof sent — deterministically. The same design
produces byte-identical output on every run, and an unchanged design costs
zero further LLM calls.

Built for [Public Nectar](https://publicnectar.co.uk).

## Status

**M0 + M1 complete.** Repo scaffolding, CI gates, and the four contracts the
rest of the pipeline is built on (see [Milestones](#milestones)). Nothing
downstream of Resolve exists yet — there is no Figma client, no transform,
and nothing writes to Klaviyo.

Full detail: [`claude/m0-m1-status.md`](claude/m0-m1-status.md).

## How it works

```
Ingest → Normalise→DesignIR → Lint gate → Resolve (LLM) ⇄ Rule cache
       → Transform (pure) → Validate → Approve (durable) → Publish
```

This is a **compiler, not a generator**. A Figma node tree is normalised
into a typed `DesignIR`, transformed by a pure function into MJML/HTML or a
Klaviyo `definition`, and validated before a human approves it. The only
non-deterministic stage is **Resolve**: an LLM classifies Figma components
("this is a button", "this link comes from the layer name") and emits small
structured `MappingRule` objects into a content-addressed cache keyed by
Figma `componentId` — it never touches markup, colour, geometry, or the
`definition` object itself. A cache hit skips the LLM entirely, so the
second email built from the same design system is free.

Everything terminates at a **draft**. Sending is always a human action.

Why this shape, and what was rejected instead, is recorded in
[`docs/adr/`](docs/adr/):

- [ADR 0001](docs/adr/0001-compiler-not-generator.md) — compiler, not generator
- [ADR 0002](docs/adr/0002-system-draggable-primary.md) — `SYSTEM_DRAGGABLE` is the primary output, `CODE` the fallback
- [ADR 0003](docs/adr/0003-runtime-secrets-not-in-github.md) — runtime secrets do not live in GitHub
- [ADR 0004](docs/adr/0004-supply-chain-gates.md) — supply-chain gates and known gaps

## Getting started

Requires Node 22+ and [pnpm](https://pnpm.io) 10.

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

| Command | What it does |
| --- | --- |
| `pnpm lint` / `pnpm lint:fix` | Biome format + lint (autofix) |
| `pnpm typecheck` | Strict TypeScript project build (`tsc -b`) |
| `pnpm test` | Vitest suite |
| `pnpm schema:generate` | Regenerate JSON Schema after touching `packages/contracts` |
| `pnpm schema:check` | Fails if generated JSON Schema is stale (run in CI) |
| `pnpm check:licenses` | Dependency licence allowlist |
| `pnpm audit --audit-level=high` | Dependency vulnerability audit |

All of the above run as blocking gates in CI
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)), alongside
secret scanning (gitleaks) and the agent-no-write guard described below.

## Repository layout

```
packages/contracts/   The four frozen contracts (DesignIR, MappingRule,
                       LintFinding, RunRecord) as strict Zod schemas, their
                       generated JSON Schema, and handwritten MappingRule
                       fixtures.
infra/                 Runtime infrastructure — currently just SecretProvider
                       (see ADR 0003).
scripts/               CI-gate scripts: schema staleness, licence allowlist,
                       the protected-paths guard.
docs/adr/               Architecture Decision Records — settled decisions and
                       their rejected alternatives.
claude/                 Planning and reference material for AI-assisted
                       development on this repo: the build plan, current
                       milestone status, and a fact-checked Figma/Klaviyo API
                       reference.
tests/                 Agent-no-write (see below).
```

## Working on this repo

This repo is built with heavy AI assistance, and is set up to make that
safe rather than to prevent it. If you're a human contributor, the short
version:

- **`tests/` and `.github/` are agent-no-write**, enforced by
  [`.github/CODEOWNERS`](.github/CODEOWNERS) and a CI check
  ([`scripts/guard-protected-paths.ts`](scripts/guard-protected-paths.ts))
  that fails any commit with an AI co-author trailer touching those paths.
- **Read [`AGENTS.md`](AGENTS.md) first** — it's the actual instruction file
  an AI agent working on this repo reads, and it says more precisely than
  this README what's settled, what the invariants are, and how work here is
  expected to proceed (spec first, one reviewable PR, verify with real
  command output, never loosen a test to make it pass).
- Current plan: [`claude/build-plan.md`](claude/build-plan.md). Its
  milestone table is reproduced below.

### Milestones

| # | What lands |
| --- | --- |
| M0 | Repo, CI, sandbox, secrets |
| M1 | The four contracts + generated JSON Schema |
| M2 | Figma client: node tree, styles, exports, rate limiting |
| M3 | Normaliser → DesignIR |
| M4 | Design-file linter |
| M5 | Transform: IR + rules → MJML → HTML |
| M6 | Validation: static lint + pixel diff vs Figma |
| M7 | Klaviyo writer: images → `CODE` template → draft campaign → proof |
| M8 | `SYSTEM_DRAGGABLE` `definition` emitter |
| M9 | Approval UI |
| M10 | LLM resolve at component level |
| M11 | Multi-tenant hardening + eval harness |

No date estimates — milestone count is the honest unit. Full dependency
graph and merge gates in `claude/build-plan.md`.
