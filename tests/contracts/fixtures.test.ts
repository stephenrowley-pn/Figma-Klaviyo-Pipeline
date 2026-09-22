import { describe, expect, it } from "vitest";
import { MAPPING_RULE_FIXTURES } from "../../packages/contracts/src/fixtures.js";

describe("MAPPING_RULE_FIXTURES", () => {
  it("has exactly six handwritten fixtures", () => {
    expect(MAPPING_RULE_FIXTURES).toHaveLength(6);
    for (const rule of MAPPING_RULE_FIXTURES) {
      expect(rule.provenance).toBe("handwritten");
    }
  });

  it("has a unique componentId per fixture", () => {
    const ids = MAPPING_RULE_FIXTURES.map((rule) => rule.componentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers more than one block type", () => {
    const blockTypes = new Set(MAPPING_RULE_FIXTURES.map((rule) => rule.blockType));
    expect(blockTypes.size).toBeGreaterThan(1);
  });
});
