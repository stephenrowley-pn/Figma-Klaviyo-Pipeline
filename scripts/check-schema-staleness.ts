import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fails if the committed `packages/contracts/schema/*.json` files do not
 * match what `pnpm schema:generate` would produce right now — i.e. someone
 * changed a Zod schema without regenerating JSON Schema.
 */

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const committedDir = path.join(repoRoot, "packages/contracts/schema");
const generatorScript = path.join(repoRoot, "packages/contracts/src/json-schema/generate.ts");

async function main(): Promise<void> {
  const scratchDir = await mkdtemp(path.join(tmpdir(), "schema-staleness-"));
  try {
    execFileSync("tsx", [generatorScript], {
      cwd: repoRoot,
      env: { ...process.env, SCHEMA_OUT_DIR_OVERRIDE: scratchDir },
      stdio: "pipe",
    });

    const committedFiles = (await readdir(committedDir)).sort();
    const mismatches: string[] = [];

    for (const file of committedFiles) {
      const committed = await readFile(path.join(committedDir, file), "utf8");
      const fresh = await readFile(path.join(scratchDir, file), "utf8");
      if (committed !== fresh) {
        mismatches.push(file);
      }
    }

    if (mismatches.length > 0) {
      console.error("Stale generated JSON Schema. Run `pnpm schema:generate` and commit the diff:");
      for (const file of mismatches) {
        console.error(`  - ${file}`);
      }
      process.exitCode = 1;
      return;
    }

    console.log(`Schema is current (${committedFiles.length} files checked).`);
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}

await main();
