/**
 * Chat Routing — единая точка резолва `activeTaskId` для входящего запроса.
 *
 * Принцип (ТЗ-ExpertiseCreateVisionRouting, 2026-04-21):
 *   Capability-driven vision fallback. Если default-модель режима не
 *   поддерживает тип вложения (например PDF у Grok) — routing переключается
 *   на `chat-vision` (Claude Haiku 4.5). Если поддерживает (Grok с JPG,
 *   Claude tiers с чем угодно) — остаётся на модели режима.
 *
 * Противоречие устранено: раньше simply всегда роутил любое вложение на
 * Haiku, expertise/create вообще не имели routing'а (сканированные PDF
 * падали). Теперь один механизм для всех chat modes через SSOT-капабилити.
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
 * SSOT-резолв активного taskId для запроса.
 *
 * Алгоритм:
 *   1. Резолв default taskId по chat mode / project tier.
 *   2. Если есть вложения и default-модель их не тянет — переключение на
 *      `chat-vision` (Claude Haiku 4.5, единственный fallback на все режимы).
 *   3. Иначе — default taskId.
 *
 * Для project chats (Claude-tiers) capability-check всегда возвращает false,
 * fallback не срабатывает — tier-модель обрабатывает вложение сама. Это
 * желаемое поведение: пользователь заплатил за tier, не подменяем на Haiku.
 */
export function resolveActiveTaskId(ctx: RoutingContext): TaskId {
  const defaultTaskId = resolveDefaultTaskId(ctx);
  if (ctx.parts.length > 0 && needsVisionFallback(ctx.parts, defaultTaskId)) {
    return "chat-vision";
  }
  return defaultTaskId;
}
