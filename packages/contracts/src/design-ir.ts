import { z } from "zod";
import { OutboundUrlSchema } from "./outbound-url.js";

/**
 * `DesignIR` is the typed tree the Normalise stage produces and the
 * Transform stage consumes. It is the one closed vocabulary the whole
 * pipeline agrees on: `Document → Section[] → Row → Column[] → Block[]`.
 * A subtree the normaliser cannot express (rotation, a mask, overlapping
 * absolutely-positioned children) is flattened to an `Image` block and
 * recorded in `unresolved`, rather than silently dropped or guessed at.
 */
export const IR_VERSION = "1" as const;

const FigmaNodeIdSchema = z.string().min(1);

const ColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "expected #rrggbb or #rrggbbaa");

const SpacingSchema = z.number().int().nonnegative();

const BlockStyleSchema = z
  .object({
    color: ColorSchema.optional(),
    backgroundColor: ColorSchema.optional(),
    fontFamily: z.string().min(1).optional(),
    fontSizePx: z.number().positive().optional(),
    fontWeight: z.number().int().min(100).max(900).optional(),
    lineHeightPx: z.number().positive().optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    paddingTopPx: SpacingSchema.optional(),
    paddingRightPx: SpacingSchema.optional(),
    paddingBottomPx: SpacingSchema.optional(),
    paddingLeftPx: SpacingSchema.optional(),
  })
  .strict();

const BlockBaseSchema = z.object({
  figmaNodeId: FigmaNodeIdSchema,
  style: BlockStyleSchema,
});

const TextBlockSchema = BlockBaseSchema.extend({
  type: z.literal("Text"),
  text: z.string(),
}).strict();

const ImageBlockSchema = BlockBaseSchema.extend({
  type: z.literal("Image"),
  src: OutboundUrlSchema,
  altText: z.string(),
  widthPx: z.number().positive(),
  heightPx: z.number().positive(),
  flattenedReason: z.string().min(1).optional(),
}).strict();

const ButtonBlockSchema = BlockBaseSchema.extend({
  type: z.literal("Button"),
  text: z.string().min(1),
  href: OutboundUrlSchema,
}).strict();

const SpacerBlockSchema = BlockBaseSchema.extend({
  type: z.literal("Spacer"),
  heightPx: z.number().positive(),
}).strict();

const DividerBlockSchema = BlockBaseSchema.extend({
  type: z.literal("Divider"),
}).strict();

const HtmlBlockSchema = BlockBaseSchema.extend({
  type: z.literal("Html"),
  html: z.string().min(1),
}).strict();

export const BlockSchema = z.discriminatedUnion("type", [
  TextBlockSchema,
  ImageBlockSchema,
  ButtonBlockSchema,
  SpacerBlockSchema,
  DividerBlockSchema,
  HtmlBlockSchema,
]);

export type Block = z.infer<typeof BlockSchema>;

export const ColumnLayoutSchema = z.enum([
  "1-column",
  "2-column-even",
  "2-column-1-2",
  "2-column-2-1",
  "3-column-even",
]);

export const ColumnSchema = z
  .object({
    figmaNodeId: FigmaNodeIdSchema,
    widthFraction: z.number().positive().max(1),
    blocks: z.array(BlockSchema),
  })
  .strict();

export type Column = z.infer<typeof ColumnSchema>;

export const RowSchema = z
  .object({
    figmaNodeId: FigmaNodeIdSchema,
    columnLayout: ColumnLayoutSchema,
    columns: z.array(ColumnSchema).min(1),
  })
  .strict();

export type Row = z.infer<typeof RowSchema>;

export const SectionSchema = z
  .object({
    figmaNodeId: FigmaNodeIdSchema,
    backgroundColor: ColorSchema.optional(),
    rows: z.array(RowSchema),
  })
  .strict();

export type Section = z.infer<typeof SectionSchema>;

/**
 * A node the normaliser could not confidently place in the tree above —
 * recorded rather than dropped, so the lint/approval surfaces can show it.
 */
export const UnresolvedNodeSchema = z
  .object({
    figmaNodeId: FigmaNodeIdSchema,
    reason: z.string().min(1),
  })
  .strict();

export type UnresolvedNode = z.infer<typeof UnresolvedNodeSchema>;

export const DesignIRSchema = z
  .object({
    irVersion: z.literal(IR_VERSION),
    figmaFileKey: z.string().min(1),
    figmaFileVersion: z.string().min(1),
    rootFigmaNodeId: FigmaNodeIdSchema,
    widthPx: z.literal(600),
    sections: z.array(SectionSchema),
    unresolved: z.array(UnresolvedNodeSchema),
  })
  .strict();

export type DesignIR = z.infer<typeof DesignIRSchema>;
