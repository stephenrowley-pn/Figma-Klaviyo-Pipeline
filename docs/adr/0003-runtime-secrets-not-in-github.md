# ADR 0003 — Runtime secrets do not live in GitHub

**Status:** Accepted

## Context

The pipeline needs two categories of secret: CI-time secrets (a staging
Klaviyo API key, a Figma cassette token for recorded-response tests) and
runtime secrets (per-client Klaviyo API keys, live Figma PATs) that the
running application reads while executing a pipeline.

GitHub Actions secrets cannot be read back once set — the REST API "gets a
single repository secret without revealing its encrypted value" and returns
only name and timestamps, and a secret is only materialised inside a running
workflow. This makes GitHub Actions secrets fine for CI but wrong for a
running service.

## Decision

Serve CI-time secrets (staging Klaviyo key, Figma cassette token) from a
GitHub Environment with required reviewers — appropriate, because CI runs are
short-lived and reviewer-gated.

Runtime secrets are deferred behind a `SecretProvider` interface with two
implementations to start: an env-var implementation for local development,
and an implementation that refuses to start for production. Choosing the
real production secrets manager (e.g. a cloud provider's secrets manager) is
a one-file change against this interface — it blocks M7 (the Klaviyo writer,
the first stage that needs a real client key), not M0–M6.

Every secret value, once loaded, is wrapped in the `Secret` type
(`packages/contracts/src/secret.ts`), which hides the value behind
`.expose()` and overrides `toString`, `toJSON`, and Node's inspect symbol —
so structured logging, span attributes, and accidental `console.log` cannot
reach it.

## Rejected alternative: GitHub Environments for runtime secrets too

Rejected because GitHub Environments are designed around gating a workflow
run, not around serving a running application — there is no API for a
long-lived service to pull a current secret value outside of a workflow
execution context, and GitHub secrets are scoped to the repository rather
than to a tenant, which conflicts with the one-key-per-client invariant.

## Consequences

- Production cannot start without a real `SecretProvider` implementation
  wired in — the refusing implementation is the default, so a misconfigured
  deploy fails loudly rather than falling back to an env var.
- The choice of actual secrets manager is deferred and does not block M0–M6.
