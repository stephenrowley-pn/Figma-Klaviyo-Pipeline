import { execFileSync } from "node:child_process";

/**
 * Fails the build if any dependency carries a licence outside the
 * allowlist. Snippet-level licence scanning (copy-pasted code, not just
 * declared dependency licences) is a known gap — tracked in ADR 0004 and
 * `claude/m0-m1-status.md`, needed before any client delivery.
 */

const ALLOWED_LICENSES = new Set([
  "MIT",
  "ISC",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "0BSD",
  "CC0-1.0",
  "Unlicense",
  "Python-2.0",
  // Weak copyleft, file-level. Tolerated for build/dev tooling only (not
  // bundled into anything shipped to a client) — see ADR 0004.
  "MPL-2.0",
]);

interface PnpmLicensesEntry {
  readonly license?: string;
  readonly name: string;
  readonly version: string;
}

/** A dual/compound SPDX expression ("MIT OR Apache-2.0") is fine if any option is allowed. */
function isAllowed(license: string): boolean {
  return license
    .split(/\s+OR\s+/i)
    .map((part) => part.trim())
    .some((part) => ALLOWED_LICENSES.has(part));
}

function main(): void {
  const raw = execFileSync("pnpm", ["licenses", "list", "--json"], { encoding: "utf8" });
  const parsed = JSON.parse(raw) as Record<string, PnpmLicensesEntry[]>;

  const violations: string[] = [];
  for (const [license, packages] of Object.entries(parsed)) {
    if (isAllowed(license)) {
      continue;
    }
    for (const pkg of packages) {
      violations.push(`${pkg.name}@${pkg.version}: ${license}`);
    }
  }

  if (violations.length > 0) {
    console.error("Dependencies outside the licence allowlist:");
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("All dependency licences are within the allowlist.");
}

main();
