/**
 * loadSkill Tool — загружает инструкции SKILL.md по требованию
 *
 * Модель вызывает этот tool когда нужны детальные инструкции
 * для выполнения сложной задачи (презентация, таблица, анализ).
 *
 * Подход Anthropic: Progressive Disclosure через tool call.
 */

import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";
import { loadSkillContent } from "@/lib/prompts/builder/skill-loader";
import { getSkillsRegistry } from "@/lib/prompts/builder/registry";

/**
 * Available skill IDs for the tool
 * These are the skills that model can load on demand
 */
const AVAILABLE_SKILLS = [
  "document/create-presentation",
  "document/create-spreadsheet",
  "document/create-text-document",
  "document/analyze-document",
  "research/web-research",
] as const;

type SkillId = (typeof AVAILABLE_SKILLS)[number];

/**
 * loadSkill tool definition
 *
 * Model calls this tool to load detailed instructions before
 * executing complex tasks like creating presentations or spreadsheets.
 */
export const loadSkill = tool({
  description: `Загружает детальные инструкции для выполнения сложной задачи.

КОГДА ИСПОЛЬЗОВАТЬ:
- Перед созданием презентации → loadSkill("document/create-presentation")
- Перед созданием таблицы → loadSkill("document/create-spreadsheet")
- Перед созданием документа → loadSkill("document/create-text-document")
- Перед анализом файла → loadSkill("document/analyze-document")
- Перед поиском информации → loadSkill("research/web-research")

ПРАВИЛО: Для сложных задач СНАЧАЛА загрузи инструкции, ПОТОМ выполняй.
Инструкции содержат важные правила — например, какие вопросы задать пользователю.`,

  inputSchema: z.object({
    skillId: z
      .enum(AVAILABLE_SKILLS)
      .describe('ID skill в формате "категория/название"'),
  }),

  execute: wrapToolExecution(
    {
      name: "loadSkill",
      timeout: 5000, // 5 seconds - simple file read
      enableLogging: true,
    },
    async ({ skillId }: { skillId: SkillId }) => {
      const content = loadSkillContent(skillId);

      if (!content) {
        // Get available skills for helpful error message
        const availableSkills = getSkillsRegistry()
          .map((s) => s.id)
          .join(", ");

        return {
          success: false,
          error: `Skill "${skillId}" не найден`,
          availableSkills,
        };
      }

      return {
        success: true,
        skillId,
        instructions: content,
        note: "Прочитай инструкции и следуй им. Особенно обрати внимание на вопросы, которые нужно задать пользователю.",
      };
    }
  ),
});
