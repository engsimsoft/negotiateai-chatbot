/**
 * Integrity check for artifact-generation skills.
 *
 * For excel/pptx/reveal: references/update.md duplicates the create-prompt
 * (full SKILL.md body) and appends update-specific delta. This duplication is
 * intentional — keeps each .md self-contained for any provider — but creates
 * the risk of silent divergence when SKILL.md is edited and update.md is not.
 *
 * This script verifies that the SKILL.md body (without frontmatter and
 * without the trailing references-footer) is a substring of update.md.
 *
 * Run: pnpm exec tsx scripts/integrity-artifact-skills.ts
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const SKILLS_ROOT = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "skills",
  "artifact-generation",
);

const FOOTER_PATTERN =
  /\n+For update operations, see \[references\/update\.md\]\(references\/update\.md\)\.\s*$/;

const KINDS_WITH_DUPLICATION = ["excel", "pptx", "reveal"] as const;

function readSkillBody(kind: string): string {
  const skillPath = path.join(SKILLS_ROOT, kind, "SKILL.md");
  const raw = fs.readFileSync(skillPath, "utf-8");
  return matter(raw).content.replace(FOOTER_PATTERN, "").trim();
}

function readUpdate(kind: string): string {
  const updatePath = path.join(SKILLS_ROOT, kind, "references", "update.md");
  return fs.readFileSync(updatePath, "utf-8").trim();
}

function check(kind: string): { ok: boolean; reason?: string } {
  const body = readSkillBody(kind);
  const update = readUpdate(kind);

  if (!update.includes(body)) {
    const firstDivergence = findFirstDivergenceIndex(body, update);
    return {
      ok: false,
      reason: `SKILL.md body is not a substring of references/update.md. First divergence around char ${firstDivergence} of SKILL body. Edit one without the other?`,
    };
  }
  return { ok: true };
}

function findFirstDivergenceIndex(needle: string, haystack: string): number {
  const lines = needle.split("\n");
  let acc = "";
  for (let i = 0; i < lines.length; i++) {
    const next = acc + (i === 0 ? "" : "\n") + lines[i];
    if (!haystack.includes(next)) {
      return acc.length;
    }
    acc = next;
  }
  return needle.length;
}

let failures = 0;
console.log("Integrity check: artifact-generation skills");
console.log("=".repeat(60));

for (const kind of KINDS_WITH_DUPLICATION) {
  const result = check(kind);
  if (result.ok) {
    console.log(`  [OK]   ${kind}: SKILL.md body ⊂ references/update.md`);
  } else {
    console.error(`  [FAIL] ${kind}: ${result.reason}`);
    failures++;
  }
}

console.log("=".repeat(60));
if (failures > 0) {
  console.error(`${failures} skill(s) failed integrity check.`);
  process.exit(1);
}
console.log("All checks passed.");
