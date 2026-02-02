/**
 * Project Context Builder (ТЗ-03)
 *
 * Builds context block from project data (instruction + files).
 * This context is injected into project chat prompts.
 */

import type { Project, ProjectFile } from "@/lib/db/schema";

/**
 * Maximum characters for extracted content per file
 */
const MAX_CONTENT_PER_FILE = 50000;

/**
 * Maximum total characters for all file contents
 */
const MAX_TOTAL_CONTENT = 150000;

/**
 * Project context data structure
 */
export interface ProjectContext {
  project: Project;
  files: ProjectFile[];
}

/**
 * Build project context block for system prompt
 *
 * @param context - Project and files data
 * @returns Formatted context string
 *
 * @example
 * ```ts
 * const context = buildProjectContext({
 *   project: { name: 'Маркетинг', instruction: 'Помогай...' },
 *   files: [{ name: 'brief.pdf', metadata: { extractedContent: '...' } }],
 * });
 * ```
 */
export function buildProjectContext(context: ProjectContext): string {
  const { project, files } = context;

  const lines: string[] = [
    "## Контекст проекта",
    "",
    `Название проекта: ${project.name}`,
  ];

  if (project.description) {
    lines.push(`Описание: ${project.description}`);
  }

  lines.push("");

  // Add instruction if present
  if (project.instruction) {
    lines.push("### Инструкция проекта");
    lines.push("");
    lines.push(project.instruction);
    lines.push("");
  }

  // Add files content if present
  const filesWithContent = files.filter(
    (f) => f.metadata?.extractedContent
  );

  if (filesWithContent.length > 0) {
    lines.push("### Документы проекта");
    lines.push("");

    let totalContent = 0;

    for (const file of filesWithContent) {
      const content = file.metadata?.extractedContent || "";
      const truncatedContent = content.slice(0, MAX_CONTENT_PER_FILE);

      // Check total limit
      if (totalContent + truncatedContent.length > MAX_TOTAL_CONTENT) {
        lines.push(
          `> Достигнут лимит контекста. Некоторые файлы не включены.`
        );
        break;
      }

      lines.push(`#### ${file.name}`);
      lines.push("");
      lines.push("```");
      lines.push(truncatedContent);
      if (content.length > MAX_CONTENT_PER_FILE) {
        lines.push(`\n[...контент обрезан, показано ${MAX_CONTENT_PER_FILE} из ${content.length} символов]`);
      }
      lines.push("```");
      lines.push("");

      totalContent += truncatedContent.length;
    }
  }

  // List files without content (images, etc.)
  const filesWithoutContent = files.filter(
    (f) => !f.metadata?.extractedContent
  );

  if (filesWithoutContent.length > 0) {
    lines.push("### Прикреплённые файлы (без текста)");
    lines.push("");
    for (const file of filesWithoutContent) {
      lines.push(`- ${file.name} (${file.mimeType})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Build a simple project context (just instruction, no files)
 * Used when files are not needed or available
 */
export function buildSimpleProjectContext(project: Project): string {
  if (!project.instruction) {
    return "";
  }

  return [
    "## Инструкция проекта",
    "",
    project.instruction,
    "",
  ].join("\n");
}
