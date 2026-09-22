import { describe, expect, it } from "vitest";
import { MappingRuleSchema } from "../../packages/contracts/src/mapping-rule.js";

const base = {
  ruleVersion: 1 as const,
  componentId: "component:test:1",
  irShapeHash: "0".repeat(64),
  blockType: "Text" as const,
  degrade: "none" as const,
  provenance: "handwritten" as const,
  createdAt: "2026-09-21T00:00:00.000Z",
};

describe("MappingRuleSchema", () => {
  it("accepts a handwritten rule with no approval needed", () => {
    expect(MappingRuleSchema.parse(base).provenance).toBe("handwritten");
  });

  // Mirrors the deliberate mutation in claude/m0-m1-status.md: "let an
  // unapproved rule through" — this must fail, not silently pass.
  it("rejects an llm-provenance rule with no approvedBy", () => {
    expect(() => MappingRuleSchema.parse({ ...base, provenance: "llm" })).toThrow();
  });

  it("accepts an llm-provenance rule once a human has approved it", () => {
    const approved = MappingRuleSchema.parse({
      ...base,
      provenance: "llm",
      approvedBy: "stephen.rowley@publicnectar.co.uk",
    });
    expect(approved.approvedBy).toBeDefined();
  });

  it("rejects flattenToImage without a recorded reason", () => {
    expect(() => MappingRuleSchema.parse({ ...base, degrade: "flattenToImage" })).toThrow();
  });

  it("accepts flattenToImage with a reason", () => {
    const rule = MappingRuleSchema.parse({
      ...base,
      degrade: "flattenToImage",
      degradeReason: "gradient over text",
    });
    expect(rule.degrade).toBe("flattenToImage");
  });

  // Mirrors the deliberate mutation: "make objects permissive" — a rule must
  // remain structurally incapable of carrying markup, colour or geometry.
  it("rejects an unknown field — smuggling markup is a parse failure, not a review miss", () => {
    expect(() => MappingRuleSchema.parse({ ...base, html: "<div>smuggled</div>" })).toThrow();
    expect(() => MappingRuleSchema.parse({ ...base, color: "#ff0000" })).toThrow();
    expect(() => MappingRuleSchema.parse({ ...base, definition: {} })).toThrow();
  });

  it("rejects an irShapeHash that isn't a lowercase sha256 hex digest", () => {
    expect(() => MappingRuleSchema.parse({ ...base, irShapeHash: "not-a-hash" })).toThrow();
    expect(() => MappingRuleSchema.parse({ ...base, irShapeHash: "A".repeat(64) })).toThrow();
  });
});
