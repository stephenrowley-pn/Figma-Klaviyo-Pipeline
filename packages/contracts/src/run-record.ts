import { z } from "zod";
import { JsonValueSchema } from "./json-value.js";
import { TenantIdSchema } from "./tenant.js";

/**
 * `RunRecord` is the audit trail for one pipeline execution. It pins every
 * version that could change the output, so a byte-for-byte reproduction
 * question ("why did this run differently?") is answerable from the record
 * alone. `rollbackPayload` is the template payload as it stood immediately
 * before a `PATCH` — captured, not recomputed, because a computed rollback
 * can be wrong in exactly the moment it matters.
 */

const Sha256HexSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected a lowercase sha256 hex digest");

export const RunRecordSchema = z
  .object({
    runId: z.uuid(),
    tenantId: TenantIdSchema,
    irVersion: z.string().min(1),
    rulesetVersion: z.string().min(1),
    transformVersion: z.string().min(1),
    modelId: z.string().min(1).optional(),
    promptHash: Sha256HexSchema.optional(),
    figmaFileVersion: z.string().min(1),
    contentHash: Sha256HexSchema,
    rollbackPayload: JsonValueSchema.nullable(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().optional(),
  })
  .strict()
  .refine((record) => record.modelId !== undefined || record.promptHash === undefined, {
    message: "promptHash requires modelId",
    path: ["modelId"],
  });

export type RunRecord = z.infer<typeof RunRecordSchema>;

export const RunRecordShape = z
  .object({
    runId: z.uuid(),
    tenantId: TenantIdSchema,
    irVersion: z.string().min(1),
    rulesetVersion: z.string().min(1),
    transformVersion: z.string().min(1),
    modelId: z.string().min(1).optional(),
    promptHash: Sha256HexSchema.optional(),
    figmaFileVersion: z.string().min(1),
    contentHash: Sha256HexSchema,
    rollbackPayload: JsonValueSchema.nullable(),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().optional(),
  })
  .strict();
