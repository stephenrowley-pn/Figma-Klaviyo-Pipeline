import { describe, expect, it } from "vitest";
import { mayWriteToProduction } from "../../packages/contracts/src/production-guard.js";
import { parseTenantId } from "../../packages/contracts/src/tenant.js";

const tenantA = parseTenantId("client-a");
const tenantB = parseTenantId("client-b");

const guard = {
  humanApprovedBy: "stephen.rowley@publicnectar.co.uk",
  stagingRunId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  stagingRunStatus: "green" as const,
  tenantId: tenantA,
  contentHash: "c".repeat(64),
  approvedAt: "2026-09-21T00:00:00.000Z",
};

describe("mayWriteToProduction", () => {
  it("allows a write matching the guard's tenant and content hash", () => {
    expect(mayWriteToProduction(guard, { tenantId: tenantA, contentHash: "c".repeat(64) })).toBe(
      true,
    );
  });

  it("denies a write for a different tenant, even with the same content hash", () => {
    expect(mayWriteToProduction(guard, { tenantId: tenantB, contentHash: "c".repeat(64) })).toBe(
      false,
    );
  });

  // Mirrors the deliberate mutation in claude/m0-m1-status.md: "drop the
  // content-hash check from the production guard" — a stale approval must
  // not authorise a write whose content has since changed.
  it("denies a write whose content hash no longer matches the approved one", () => {
    expect(mayWriteToProduction(guard, { tenantId: tenantA, contentHash: "d".repeat(64) })).toBe(
      false,
    );
  });
});
