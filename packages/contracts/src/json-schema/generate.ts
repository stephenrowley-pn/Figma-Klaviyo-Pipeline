import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { DesignIRSchema } from "../design-ir.js";
import { LintFindingSchema } from "../lint-finding.js";
import { MappingRuleShape } from "../mapping-rule.js";
import { RunRecordShape } from "../run-record.js";

/**
 * Generates the JSON Schema files committed under `packages/contracts/schema/`.
 * `MappingRuleShape` / `RunRecordShape` are the pre-refinement object shapes:
 * Zod's JSON Schema export cannot represent a `.refine()` predicate, so the
 * refinements live only in the TypeScript-facing `*Schema` exports and are
 * covered by tests instead. Run via `pnpm schema:generate`; staleness is
 * checked in CI via `pnpm schema:check`.
 */

const schemas = {
  "design-ir": DesignIRSchema,
  "mapping-rule": MappingRuleShape,
  "lint-finding": LintFindingSchema,
  "run-record": RunRecordShape,
} as const;

async function main(): Promise<void> {
  const outDir =
    process.env.SCHEMA_OUT_DIR_OVERRIDE ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../../schema");
  await mkdir(outDir, { recursive: true });

  for (const [name, schema] of Object.entries(schemas)) {
    const jsonSchema = z.toJSONSchema(schema, { target: "draft-2020-12" });
    const withHeading = {
      $comment: "GENERATED — run `pnpm schema:generate`. Do not hand-edit.",
      ...jsonSchema,
    };
    const outFile = path.join(outDir, `${name}.schema.json`);
    await writeFile(outFile, `${JSON.stringify(withHeading, null, 2)}\n`, "utf8");
    console.log(`wrote ${path.relative(process.cwd(), outFile)}`);
  }
}

await main();
