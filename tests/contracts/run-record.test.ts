import { describe, expect, it } from "vitest";
import { RunRecordSchema } from "../../packages/contracts/src/run-record.js";
import { parseTenantId } from "../../packages/contracts/src/tenant.js";

const base = {
  runId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  tenantId: parseTenantId("client-acme"),
  irVersion: "1",
  rulesetVersion: "1",
  transformVersion: "1",
  figmaFileVersion: "42",
  contentHash: "a".repeat(64),
  rollbackPayload: null,
  startedAt: "2026-09-21T00:00:00.000Z",
};

describe("RunRecordSchema", () => {
  it("accepts a minimal run with no LLM stage involved", () => {
    expect(RunRecordSchema.parse(base).contentHash).toBe("a".repeat(64));
  });

  it("accepts modelId + promptHash together", () => {
    const withModel = RunRecordSchema.parse({
      ...base,
      modelId: "claude-sonnet-5",
      promptHash: "b".repeat(64),
    });
    expect(withModel.modelId).toBe("claude-sonnet-5");
  });

  it("rejects promptHash without modelId", () => {
    expect(() => RunRecordSchema.parse({ ...base, promptHash: "b".repeat(64) })).toThrow();
  });

  it("stores an arbitrary rollback payload captured before a PATCH", () => {
    const withRollback = RunRecordSchema.parse({
      ...base,
      rollbackPayload: { html: "<div>previous template</div>", editor_type: "CODE" },
    });
    expect(withRollback.rollbackPayload).toEqual({
      html: "<div>previous template</div>",
      editor_type: "CODE",
    });
  });

  it("rejects an unknown top-level field", () => {
    expect(() => RunRecordSchema.parse({ ...base, apiKey: "sk_live_secret" })).toThrow();
  });
});
