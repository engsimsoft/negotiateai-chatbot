/**
 * ТЗ-COMPACTION-1: User-visible compaction event (Simply Compaction MVP).
 *
 * Отдельный от dev-метрик канал `data-compaction` — кормит widget контекста
 * ([components/elements/context.tsx](../../../components/elements/context.tsx))
 * индикатором «📦 Разговор сжат» / «⚠️ Рекомендуем начать новый чат». Работает
 * для ВСЕХ пользователей (не gated `isSimplyDevMode`).
 *
 * Не путать с `emitDebugCompaction` из `lib/ai/debug-events.ts` — это
 * DEV-only helper для Anthropic provider compaction iterations (legacy
 * ТЗ-RAG3). У них разная семантика, разные клиенты, разные event types.
 *
 * Архитектурный источник: specs/Simply_xAI/SIMPLY_COMPACTION_ARCHITECTURE.md v1.9
 * §Виджет контекста → Реализация через DataStream protocol.
 */

import type { CompactionEvent } from "./types";

/**
 * Минимальный интерфейс writer'а (совпадает с DataStreamWriter из
 * `debug-events.ts` — избегаем жёсткого импорта, чтобы не создавать обратную
 * зависимость и не путать с dev-гардом).
 */
interface DataStreamWriter {
  write(event: { type: string; data?: unknown; transient?: boolean }): void;
}

/**
 * Эмитит user-visible compaction event. Без gating — виджет пользователя
 * должен работать в production. Все 6 полей `CompactionEvent` идут в stream
 * без фильтрации; клиент сам решает какие показывать.
 */
export function emitCompactionEvent(
  dataStream: DataStreamWriter,
  data: CompactionEvent,
): void {
  dataStream.write({
    type: "data-compaction",
    data,
  });
}
