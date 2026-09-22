import { z } from "zod";
import { LINT_COPY_CATALOGUE } from "./lint-copy.js";

/**
 * `LintFinding` is what the design-file linter (M4) surfaces to a designer.
 * The `message` and `fixHint` are product copy, not developer diagnostics —
 * "fix your Figma file", never "wrong email". `code` is constrained to the
 * catalogue in `lint-copy.ts` so copy is reviewed in one place rather than
 * scattered through the linter's implementation.
 */

const LintCodeSchema = z.enum(Object.keys(LINT_COPY_CATALOGUE) as [string, ...string[]]);

export const LintSeveritySchema = z.enum(["error", "warning"]);

export const LintFindingSchema = z
  .object({
    code: LintCodeSchema,
    severity: LintSeveritySchema,
    figmaNodeId: z.string().min(1),
    message: z.string().min(1),
    fixHint: z.string().min(1),
  })
  .strict();

export type LintFinding = z.infer<typeof LintFindingSchema>;

/**
 * Builds a `LintFinding` from the catalogue so the copy for a given `code`
 * can only ever be the reviewed copy — a caller cannot pass an ad hoc
 * message for a known code.
 */
export function lintFinding(
  code: keyof typeof LINT_COPY_CATALOGUE,
  figmaNodeId: string,
): LintFinding {
  const entry = LINT_COPY_CATALOGUE[code];
  return LintFindingSchema.parse({
    code,
    severity: entry.severity,
    figmaNodeId,
    message: entry.message,
    fixHint: entry.fixHint,
  });
}
