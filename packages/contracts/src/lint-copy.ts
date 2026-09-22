/**
 * The single catalogue of designer-facing lint copy. `LintFinding.code` is
 * constrained to these keys, so every finding a designer sees has been
 * reviewed here — never assembled ad hoc in the linter.
 *
 * These words must never appear in `message` or `fixHint`: they read as
 * implementation detail, not as feedback on a Figma file. The catalogue
 * test in `tests/contracts/lint-copy.test.ts` enforces this.
 */
export const BANNED_PIPELINE_VOCABULARY: readonly string[] = [
  "DesignIR",
  "MappingRule",
  "componentId",
  "figmaNodeId",
  "pipeline",
  "schema",
  "Zod",
  "IR",
  "transform",
  "backend",
];

export interface LintCopyEntry {
  readonly severity: "error" | "warning";
  readonly message: string;
  readonly fixHint: string;
}

export const LINT_COPY_CATALOGUE = {
  "frame/missing-auto-layout": {
    severity: "error",
    message: "This frame doesn't use auto layout, so we can't tell how it should flow on mobile.",
    fixHint: "Select the frame and turn on auto layout (Shift+A), then set direction and spacing.",
  },
  "frame/wrong-width": {
    severity: "error",
    message: "This frame isn't 600px wide, which is the width every email needs to start from.",
    fixHint: "Resize the frame to exactly 600px wide.",
  },
  "node/missing-export-settings": {
    severity: "error",
    message: "This image doesn't have export settings, so we don't know how to export it.",
    fixHint: "Select the layer, open the Export panel, and add a 2x PNG or JPG export.",
  },
  "layer/unrecognised-name": {
    severity: "warning",
    message: "This layer's name doesn't match a block we recognise, so we're guessing what it is.",
    fixHint:
      "Rename the layer using one of the standard block names (see the design system guide).",
  },
  "cta/missing-link": {
    severity: "error",
    message: "This looks like a button, but it isn't linked to anywhere.",
    fixHint: "Add a link: set an Open Link interaction, or a hyperlink on the text.",
  },
  "layout/overlapping-elements": {
    severity: "error",
    message: "These elements overlap, which doesn't translate to an email layout.",
    fixHint:
      "Rearrange the elements so nothing overlaps, or group them as a single flattened image.",
  },
} as const satisfies Record<string, LintCopyEntry>;

export type LintCode = keyof typeof LINT_COPY_CATALOGUE;
