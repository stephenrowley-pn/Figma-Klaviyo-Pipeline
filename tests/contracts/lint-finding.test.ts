import { describe, expect, it } from "vitest";
import { LINT_COPY_CATALOGUE } from "../../packages/contracts/src/lint-copy.js";
import { LintFindingSchema, lintFinding } from "../../packages/contracts/src/lint-finding.js";

describe("lintFinding", () => {
  it("builds a finding whose copy matches the catalogue exactly", () => {
    const finding = lintFinding("cta/missing-link", "1:23");
    const entry = LINT_COPY_CATALOGUE["cta/missing-link"];
    expect(finding.message).toBe(entry.message);
    expect(finding.fixHint).toBe(entry.fixHint);
    expect(finding.severity).toBe(entry.severity);
    expect(finding.figmaNodeId).toBe("1:23");
  });

  it("covers every catalogue entry without throwing", () => {
    for (const code of Object.keys(LINT_COPY_CATALOGUE)) {
      expect(() => lintFinding(code as keyof typeof LINT_COPY_CATALOGUE, "1:1")).not.toThrow();
    }
  });
});

describe("LintFindingSchema", () => {
  it("rejects a code that isn't in the catalogue — a caller cannot invent ad hoc copy", () => {
    expect(() =>
      LintFindingSchema.parse({
        code: "not-a-real-code",
        severity: "error",
        figmaNodeId: "1:1",
        message: "invented message",
        fixHint: "invented hint",
      }),
    ).toThrow();
  });
});
