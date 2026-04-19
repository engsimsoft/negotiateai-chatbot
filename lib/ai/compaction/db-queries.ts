/**
 * ТЗ-COMPACTION-1: Read/write 3 полей compaction-состояния в Chat таблице.
 *
 * Поля миграции 0056: `compactionSummary` / `compactionIndex` / `compactionCount`.
 * DB pattern зеркалирует `lib/ai/memory/memory-queries.ts` — отдельный Neon
 * HTTP клиент, прямой доступ к schema, минимум зависимостей.
 */

import "server-only";

import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { chat } from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// DB connection (same pattern as lib/db/queries.ts + memory-queries.ts)
// ---------------------------------------------------------------------------

// biome-ignore lint: non-null assertion — POSTGRES_URL обязателен, каждый deploy падает без него на старте.
const sql_client = neon(process.env.POSTGRES_URL!);
const db = drizzle(sql_client);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompactionState {
  /** Текущий summary (null = compaction для этого чата ни разу не срабатывал). */
  summary: string | null;
  /** Индекс последнего сжатого сообщения на предыдущем turn'е (null при Phase 0). */
  index: number | null;
  /** Счётчик завершённых compaction-циклов (default 0, монотонно растёт). */
  count: number;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Читает compaction state для чата. Если чат не найден — возвращает
 * дефолтное состояние (summary=null, index=null, count=0): для новых чатов
 * compaction ещё не срабатывал, это равно "Phase 0".
 */
export async function getCompactionState(
  chatId: string,
): Promise<CompactionState> {
  const rows = await db
    .select({
      summary: chat.compactionSummary,
      index: chat.compactionIndex,
      count: chat.compactionCount,
    })
    .from(chat)
    .where(eq(chat.id, chatId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return { summary: null, index: null, count: 0 };
  }

  return {
    summary: row.summary,
    index: row.index,
    count: row.count,
  };
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Атомарная запись compaction state (3 поля одним UPDATE). Вызывается из
 * middleware после успешной генерации summary и сборки нового messages-массива.
 */
export async function saveCompactionState(
  chatId: string,
  state: CompactionState,
): Promise<void> {
  await db
    .update(chat)
    .set({
      compactionSummary: state.summary,
      compactionIndex: state.index,
      compactionCount: state.count,
    })
    .where(eq(chat.id, chatId));
}
