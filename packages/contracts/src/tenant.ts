import { z } from "zod";

/**
 * A tenant identifier is only ever produced by parsing through this schema —
 * there is no other way to construct a `TenantId`, so a caller cannot forge
 * one by casting a bare string.
 */
export const TenantIdSchema = z.string().min(1).max(128).brand<"TenantId">();

export type TenantId = z.infer<typeof TenantIdSchema>;

export function parseTenantId(value: string): TenantId {
  return TenantIdSchema.parse(value);
}

/**
 * Every cache key is tenant-scoped by construction: `tenantId` is the first,
 * required, branded parameter, so a missing tenant prefix is a type error
 * at the call site rather than something a review has to notice.
 */
export function cacheKey(tenantId: TenantId, ...parts: readonly string[]): string {
  return ["tenant", tenantId, ...parts].join(":");
}
