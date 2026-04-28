/**
 * Chat Routing — единая точка резолва `activeTaskId` для входящего запроса.
 *
 * Принцип (ТЗ-ExpertiseCreateVisionRouting, 2026-04-21 + TZ_FilesAPIMigration, 2026-04-29):
 *   - Image attachments — capability-driven fallback (если default-модель не
 *     vision-capable → chat-vision).
 *   - **Non-image file attachments** (PDF/DOCX/XLSX/CSV/TXT/MD) — всегда идут
 *     на chat-vision как universal attachment routing slot (Шаг 4 SPEC v3 §5.2).
 *     Phase 1.5 R2 показал что все Grok'и принимают input_file, но мы
 *     централизуем file processing на chat-vision для product control:
 *     Vladimir может в /dev/models переключить модель файлового пути одним
 *     кликом, не меняя default моделей режимов.
 *
 * Project chats не подпадают — tier-модель обрабатывает вложение сама.
 */

import type { TaskId } from "./task-assignments";
import { getModelIdForTask } from "./getModel";
import { getModelEntry } from "./model-catalog";
import { getTaskIdForChatMode, type ChatMode } from "./chat-mode-config";
import { getTaskIdForTier, type ProjectModelTier } from "./model-tiers";

export interface RoutingContext {
  chatMode: ChatMode;
  think?: boolean;
  isProjectChat: boolean;
  tier?: ProjectModelTier;
  parts: readonly any[];
}

/**
 * Capability-driven проверка: нужен ли fallback на vision-модель.
 * Читает `capabilities` модели default-taskId из SSOT каталога. Возвращает
 * true если хотя бы одно вложение в `parts` — того типа, который модель не
 * поддерживает.
 */
export function needsVisionFallback(
  parts: readonly any[],
  defaultTaskId: TaskId,
): boolean {
  const caps = getModelEntry(getModelIdForTask(defaultTaskId))?.capabilities;
  if (!caps) return false;

  return parts.some((part: any) => {
    if (part?.type === "image") return !caps.vision;

    if (part?.type === "file") {
      const mediaType: string = part.mediaType ?? "";
      if (mediaType.startsWith("image/")) return !caps.vision;
      if (mediaType === "application/pdf") {
        return caps.documentSupport?.supported !== true;
      }
    }
    return false;
  });
}

/**
 * Резолвит default taskId для chat-режима без учёта вложений.
 * Вложения обрабатываются уровнем выше — в `resolveActiveTaskId`.
 */
function resolveDefaultTaskId(ctx: RoutingContext): TaskId {
  if (ctx.isProjectChat && ctx.tier) {
    return getTaskIdForTier(ctx.tier);
  }
  if (ctx.chatMode === "simply") {
    return ctx.think === true ? "simply-chat-think" : "simply-chat";
  }
  return getTaskIdForChatMode(ctx.chatMode);
}

/**
 * Проверка наличия не-image file attachments (PDF/DOCX/XLSX/CSV/TXT/MD).
 * Шаг 4 SPEC v3 §5.2: все такие файлы идут на chat-vision независимо от
 * capability default-модели. Image — отдельный путь через needsVisionFallback.
 */
function hasNonImageFileAttachment(parts: readonly any[]): boolean {
  return parts.some((part: any) => {
    if (part?.type !== "file") return false;
    const mediaType: string = part.mediaType ?? "";
    return mediaType !== "" && !mediaType.startsWith("image/");
  });
}

/**
 * SSOT-резолв активного taskId для запроса.
 *
 * Алгоритм:
 *   1. Резолв default taskId по chat mode / project tier.
 *   2. Project chats не роутятся — tier-модель обрабатывает вложение сама.
 *   3. Если есть non-image file attachment (PDF/DOCX/...) — chat-vision
 *      (universal attachment slot, Шаг 4).
 *   4. Если есть image и default-модель не vision-capable — chat-vision.
 *   5. Иначе — default taskId.
 */
export function resolveActiveTaskId(ctx: RoutingContext): TaskId {
  const defaultTaskId = resolveDefaultTaskId(ctx);
  if (ctx.isProjectChat) return defaultTaskId;
  if (ctx.parts.length === 0) return defaultTaskId;
  if (hasNonImageFileAttachment(ctx.parts)) return "chat-vision";
  if (needsVisionFallback(ctx.parts, defaultTaskId)) return "chat-vision";
  return defaultTaskId;
}
