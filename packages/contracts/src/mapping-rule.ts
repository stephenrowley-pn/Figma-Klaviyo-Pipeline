import { z } from "zod";

/**
 * `MappingRule` is the only thing the Resolve (LLM) stage is allowed to
 * emit. It is deliberately incapable of carrying a colour, a pixel value,
 * an HTML fragment, or a Klaviyo `definition` fragment: every field is an
 * enum or a reference into the `DesignIR`, the object is `.strict()`, so an
 * attempt to smuggle markup or styling through an unknown key is a parse
 * failure, not a review miss.
 */

export const MAPPING_RULE_VERSION = 1 as const;

export const MappingRuleProvenanceSchema = z.enum(["handwritten", "llm", "human_edited"]);

export type MappingRuleProvenance = z.infer<typeof MappingRuleProvenanceSchema>;

export const BlockTypeSchema = z.enum(["Text", "Image", "Button", "Spacer", "Divider", "Html"]);

export const TextSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ownCharacters") }).strict(),
  z.object({ kind: z.literal("childNodeIndex"), index: z.number().int().nonnegative() }).strict(),
  z.object({ kind: z.literal("layerName") }).strict(),
]);

export type TextSource = z.infer<typeof TextSourceSchema>;

export const LinkSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("styleHyperlink") }).strict(),
  z.object({ kind: z.literal("styleOverrideTable") }).strict(),
  z.object({ kind: z.literal("interaction") }).strict(),
  z.object({ kind: z.literal("layerNameSuffix"), separator: z.string().min(1) }).strict(),
]);

export type LinkSource = z.infer<typeof LinkSourceSchema>;

export const DegradationSchema = z.enum(["none", "flattenToImage"]);

const IrShapeHashSchema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, "expected a lowercase sha256 hex digest");

export const MappingRuleSchema = z
  .object({
    ruleVersion: z.literal(MAPPING_RULE_VERSION),
    componentId: z.string().min(1),
    irShapeHash: IrShapeHashSchema,
    blockType: BlockTypeSchema,
    textSource: TextSourceSchema.optional(),
    linkSource: LinkSourceSchema.optional(),
    altTextSource: TextSourceSchema.optional(),
    degrade: DegradationSchema,
    degradeReason: z.string().min(1).optional(),
    provenance: MappingRuleProvenanceSchema,
    approvedBy: z.string().min(1).optional(),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .refine((rule) => rule.provenance !== "llm" || rule.approvedBy !== undefined, {
    message: "an llm-provenance rule must carry approvedBy before it can be cached",
    path: ["approvedBy"],
  })
  .refine((rule) => rule.degrade !== "flattenToImage" || rule.degradeReason !== undefined, {
    message: "flattenToImage requires degradeReason",
    path: ["degradeReason"],
  });

export type MappingRule = z.infer<typeof MappingRuleSchema>;

/** The plain object shape, for JSON Schema generation (refinements do not export). */
export const MappingRuleShape = z
  .object({
    ruleVersion: z.literal(MAPPING_RULE_VERSION),
    componentId: z.string().min(1),
    irShapeHash: IrShapeHashSchema,
    blockType: BlockTypeSchema,
    textSource: TextSourceSchema.optional(),
    linkSource: LinkSourceSchema.optional(),
    altTextSource: TextSourceSchema.optional(),
    degrade: DegradationSchema,
    degradeReason: z.string().min(1).optional(),
    provenance: MappingRuleProvenanceSchema,
    approvedBy: z.string().min(1).optional(),
    createdAt: z.iso.datetime(),
  })
  .strict();
