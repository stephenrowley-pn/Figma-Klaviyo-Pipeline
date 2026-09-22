import { describe, expect, it } from "vitest";
import {
  BANNED_PIPELINE_VOCABULARY,
  LINT_COPY_CATALOGUE,
} from "../../packages/contracts/src/lint-copy.js";

describe("LINT_COPY_CATALOGUE", () => {
  it("is free of pipeline vocabulary — a designer reads 'fix your file', not 'wrong email'", () => {
    for (const [code, entry] of Object.entries(LINT_COPY_CATALOGUE)) {
      for (const banned of BANNED_PIPELINE_VOCABULARY) {
        expect(entry.message, `${code}.message contains "${banned}"`).not.toContain(banned);
        expect(entry.fixHint, `${code}.fixHint contains "${banned}"`).not.toContain(banned);
      }
    }
  });

  it("gives every entry a non-empty message and fix hint", () => {
    for (const entry of Object.values(LINT_COPY_CATALOGUE)) {
      expect(entry.message.length).toBeGreaterThan(0);
      expect(entry.fixHint.length).toBeGreaterThan(0);
    }
  });
});
