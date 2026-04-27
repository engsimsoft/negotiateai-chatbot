import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { render } from "@/lib/prompts/template";

export type ArtifactSkillKind = "text" | "markdown" | "excel" | "pptx" | "reveal";
export type ArtifactSkillOp = "create" | "update";

const SKILLS_ROOT = path.join(
  process.cwd(),
  "lib",
  "prompts",
  "skills",
  "artifact-generation",
);

const FOOTER_PATTERN =
  /\n+For update operations, see \[references\/update\.md\]\(references\/update\.md\)\.\s*$/;

const cache = new Map<string, string>();

function isCacheEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

function readTemplate(kind: ArtifactSkillKind, op: ArtifactSkillOp): string {
  const cacheKey = `${kind}:${op}`;
  if (isCacheEnabled()) {
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
  }

  const filePath =
    op === "create"
      ? path.join(SKILLS_ROOT, kind, "SKILL.md")
      : path.join(SKILLS_ROOT, kind, "references", "update.md");

  if (!fs.existsSync(filePath)) {
    throw new Error(`Artifact skill file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  let body: string;
  if (op === "create") {
    body = matter(raw).content.replace(FOOTER_PATTERN, "").trim();
  } else {
    body = raw.trim();
  }

  if (isCacheEnabled()) {
    cache.set(cacheKey, body);
  }
  return body;
}

export function loadArtifactSkill(
  kind: ArtifactSkillKind,
  op: ArtifactSkillOp,
  vars?: Record<string, string>,
): string {
  const template = readTemplate(kind, op);
  return render(template, vars ?? {});
}
