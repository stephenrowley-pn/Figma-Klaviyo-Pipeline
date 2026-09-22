import { z } from "zod";

/**
 * A URL destined for an email. Rejects `figma.com` because Figma's export
 * URLs expire (30 days for renders, 14 for raw image fills) and must never
 * be shipped — assets are re-hosted content-addressed before this type is
 * used.
 *
 * Known gap, tracked for M2: this only denies the `figma.com` hostname, not
 * Figma's S3 render hosts. The test for this file asserts the gap rather
 * than silently widening the deny list, so the fixture below is expected to
 * pass today and is the one to update when the S3 hostnames are added.
 */
export const OutboundUrlSchema = z
  .url()
  .refine((value) => !/(^|\.)figma\.com$/i.test(new URL(value).hostname), {
    message: "must not reference figma.com — re-host content-addressed assets before use",
  });

export type OutboundUrl = z.infer<typeof OutboundUrlSchema>;
