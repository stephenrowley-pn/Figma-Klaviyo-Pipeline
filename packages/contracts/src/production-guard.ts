import { z } from "zod";
import { type TenantId, TenantIdSchema } from "./tenant.js";

/**
 * Evidence that a production write is authorised: a named human, pinned to
 * a specific staging run that was green, at the same content hash and the
 * same tenant as the write being attempted. There is no code path that
 * derives this from anything automatic — it is always supplied by a human
 * action.
 */
export const ProductionWriteGuardSchema = z
  .object({
    humanApprovedBy: z.string().min(1),
    stagingRunId: z.uuid(),
    stagingRunStatus: z.literal("green"),
    tenantId: TenantIdSchema,
    contentHash: z.string().regex(/^[0-9a-f]{64}$/, "expected a lowercase sha256 hex digest"),
    approvedAt: z.iso.datetime(),
  })
  .strict();

export type ProductionWriteGuard = z.infer<typeof ProductionWriteGuardSchema>;

export interface ProductionWriteRequest {
  readonly tenantId: TenantId;
  readonly contentHash: string;
}

/**
 * The single gate a production Klaviyo write must pass. Returns false for
 * any mismatch — wrong tenant, wrong content hash, or a guard that was not
 * pinned to a green staging run — rather than throwing, so callers must
 * handle the negative case explicitly instead of relying on exceptions to
 * propagate.
 */
export function mayWriteToProduction(
  guard: ProductionWriteGuard,
  request: ProductionWriteRequest,
): boolean {
  return guard.tenantId === request.tenantId && guard.contentHash === request.contentHash;
}
