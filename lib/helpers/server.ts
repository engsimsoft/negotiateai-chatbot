/**
 * Server-side Helper Utilities (ТЗ-07A)
 *
 * Серверные функции для работы с помощниками.
 * Используют DB queries — только для server components и API routes.
 */

import "server-only";

import { getHelperById as getHelperFromDb } from "@/lib/db/queries";
import type { CustomHelper, Helper, PresetHelper } from "./types";
import { getPresetHelperById, isPresetHelperId } from "./presets";

/**
 * Получить помощника по ID (из presets или DB)
 *
 * @param id - ID помощника (preset ID или UUID)
 * @returns Helper или null если не найден
 */
export async function getHelperById(id: string): Promise<Helper | null> {
  // Сначала проверяем presets (быстрее, без обращения к БД)
  if (isPresetHelperId(id)) {
    return getPresetHelperById(id);
  }

  // Иначе ищем в БД
  const dbHelper = await getHelperFromDb({ id });

  if (!dbHelper) {
    return null;
  }

  // Преобразуем в CustomHelper
  const customHelper: CustomHelper = {
    id: dbHelper.id,
    type: "custom",
    userId: dbHelper.userId,
    name: dbHelper.name,
    emoji: dbHelper.emoji,
    instruction: dbHelper.instruction,
    skills: dbHelper.skills,
    createdAt: dbHelper.createdAt,
  };

  return customHelper;
}

/**
 * Получить системный промпт помощника по ID
 *
 * @param id - ID помощника
 * @returns Instruction string или null
 */
export async function getHelperInstruction(id: string): Promise<string | null> {
  const helper = await getHelperById(id);

  if (!helper) {
    return null;
  }

  return helper.instruction || null;
}

/**
 * Получить навыки помощника по ID
 *
 * @param id - ID помощника
 * @returns Массив ID навыков или пустой массив
 */
export async function getHelperSkills(id: string): Promise<string[]> {
  const helper = await getHelperById(id);

  if (!helper || !helper.skills) {
    return [];
  }

  return helper.skills;
}
