import { execFileSync } from "node:child_process";

/**
 * Fails if any commit being checked both (a) carries an AI co-author
 * trailer and (b) touches `tests/` or `.github/`. Those paths are
 * agent-no-write; this is the CI half of the guard (CODEOWNERS is the
 * other half — see AGENTS.md).
 *
 * The bootstrap commit that first adds this script is a known, documented
 * exception (see `claude/m0-m1-status.md` and `tests/README.md`) and is
 * expected to trip this check; it merges via an admin bypass, once, after
 * which branch protection is turned on and no further exception is made.
 *
 * Compares `baseRef...headRef` (default `origin/main...HEAD`), overridable
 * via BASE_REF / HEAD_REF for CI.
 */

const PROTECTED_PATH_PREFIXES = ["tests/", ".github/"];
const AI_TRAILER_PATTERN = /^co-authored-by:.*\b(claude|copilot|codex|gemini|gpt)\b/im;

const baseRef = process.env.BASE_REF ?? "origin/main";
const headRef = process.env.HEAD_REF ?? "HEAD";

function git(args: string[], options: { quiet?: boolean } = {}): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: options.quiet ? ["ignore", "pipe", "ignore"] : undefined,
  });
}

function commitShas(range: string): string[] {
  return git(["rev-list", range]).split("\n").filter(Boolean);
}

function changedPaths(sha: string): string[] {
  return git(["show", "--name-only", "--pretty=format:", sha]).split("\n").filter(Boolean);
}

function commitMessage(sha: string): string {
  return git(["show", "-s", "--format=%B", sha]);
}

function touchesProtectedPath(paths: readonly string[]): boolean {
  return paths.some((file) => PROTECTED_PATH_PREFIXES.some((prefix) => file.startsWith(prefix)));
}

function main(): void {
  try {
    git(["rev-parse", baseRef], { quiet: true });
  } catch {
    console.log(`Base ref ${baseRef} not found locally; skipping protected-paths guard.`);
    return;
  }

  const shas = commitShas(`${baseRef}...${headRef}`);
  const violations: string[] = [];

  for (const sha of shas) {
    const message = commitMessage(sha);
    if (!AI_TRAILER_PATTERN.test(message)) {
      continue;
    }
    const paths = changedPaths(sha);
    if (touchesProtectedPath(paths)) {
      violations.push(sha);
    }
  }

  if (violations.length > 0) {
    console.error(
      "Commits with an AI co-author trailer touch agent-no-write paths (tests/, .github/):",
    );
    for (const sha of violations) {
      console.error(`  - ${sha}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Protected-paths guard passed (${shas.length} commits checked).`);
}

main();
