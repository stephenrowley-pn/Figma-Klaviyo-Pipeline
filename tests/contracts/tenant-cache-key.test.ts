import { describe, expect, it } from "vitest";
import { cacheKey, parseTenantId, TenantIdSchema } from "../../packages/contracts/src/tenant.js";

describe("TenantIdSchema", () => {
  it("rejects an empty string", () => {
    expect(() => parseTenantId("")).toThrow();
  });

  it("accepts a non-empty string", () => {
    expect(parseTenantId("client-acme")).toBe("client-acme");
  });
});

describe("cacheKey", () => {
  // Mirrors the deliberate mutation in claude/m0-m1-status.md: "drop the
  // tenant prefix". `cacheKey` takes a branded TenantId as its first,
  // required parameter — there is no overload that omits it, so this is
  // also a compile-time guarantee, not only the runtime shape asserted here.
  it("always prefixes the key with the tenant", () => {
    const tenantId = parseTenantId("client-acme");
    const key = cacheKey(tenantId, "componentId:abc", "irShapeHash:def");
    expect(key).toBe("tenant:client-acme:componentId:abc:irShapeHash:def");
    expect(key.startsWith("tenant:client-acme:")).toBe(true);
  });

  it("keeps two tenants' keys distinct for the same logical parts", () => {
    const a = cacheKey(parseTenantId("client-a"), "same-part");
    const b = cacheKey(parseTenantId("client-b"), "same-part");
    expect(a).not.toBe(b);
  });

  it("only accepts a TenantId parsed through the branded schema (type-level guarantee)", () => {
    // A bare string is not assignable where TenantId is required — this is
    // enforced by `tsc` at compile time (see AGENTS.md's tenant-prefix
    // invariant); this parse is the runtime half of the same guarantee.
    expect(() => TenantIdSchema.parse(123)).toThrow();
  });
});
