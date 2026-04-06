# ADR 040: MIND Extract + Retrieve — архитектура извлечения и использования памяти

**Дата:** 2026-04-06
**Статус:** Принято

---

## Контекст

RAG-0 (v3.70.0) создал инфраструктуру: pgvector, Voyage AI, таблицу `memory_entry`. Нужно было решить как именно извлекать факты из разговоров и инжектировать их в будущие чаты.

Ключевые вопросы:
- Когда извлекать факты (синхронно / асинхронно)?
- Какой моделью извлекать (Haiku / Sonnet)?
- Как дедуплицировать (точное / семантическое)?
- Куда инжектировать (system prompt / отдельный блок)?
- Как не сломать чат при недоступности Voyage API?

---

## Решение

**Fire-and-forget extraction + pre-request retrieval:**

1. **Extract** — после сохранения сообщений в `onFinish`, fire-and-forget (`void ... .catch()`)
2. **Retrieve** — синхронно перед `streamText`, инжекция в system prompt
3. **Модель** — Claude Sonnet через `generateObject()` с Zod-схемой
4. **Дедупликация** — cosine similarity > 0.92 + category match → supersede
5. **Инжекция** — XML-блок `<memory>` с мягкой формулировкой

---

## Причины

1. **Fire-and-forget extraction** — не увеличивает latency ответа. Пользователь не ждёт пока факты сохранятся. Если extraction упадёт — чат продолжит работать.

2. **Sonnet для extraction (не Haiku)** — качество извлечения критично. Haiku пропускает неявные факты и генерирует тривиальные. Sonnet стоит ~$0.008 за extraction, вызывается раз за сообщение — приемлемо.

3. **generateObject + Zod** — structured output гарантирует валидный JSON с category и confidence. Без парсинга, без `stripCodeBlocks()`. Ограничение: Anthropic API не поддерживает `min`/`max` в Zod `number()` — валидация через промпт.

4. **Cosine > 0.92 + category** — чисто cosine даёт false positives (разные факты с похожими словами). Category match сужает область дедупликации. Порог 0.92 эмпирически найден в RAG-0 тестах.

5. **Мягкая формулировка** — "Из предыдущих разговоров известно..." + инструкция "упоминай только если релевантно". Без этого модель навязчиво пересказывает все факты.

6. **Graceful degradation** — `try/catch` на retrieve и extract. При ошибке Voyage API (403, timeout) чат работает без памяти. Log warning, не crash.

---

## Последствия

### Плюсы

- Нулевое влияние на latency ответа (extraction в background)
- Retrieve добавляет ~1-2с к первому ответу (Voyage embed + pgvector search)
- Полный cost tracking с первого дня (memory:extract, memory:embed, memory:search)
- Dev Panel показывает какие факты использованы (similarity, confidence)
- Работает для chat, expertise, create, project tasks

### Минусы

- Sonnet extraction стоит ~$0.008 за сообщение (дороже Haiku в ~10x)
- Факт доступен только в следующем чате (не в текущем, т.к. extraction в background)
- Voyage API — single point of failure для embeddings (нет fallback провайдера)
- Нет UI для управления фактами (удаление, редактирование) — запланировано в RAG-2

---

## Альтернативы

### Альтернатива 1: Синхронная extraction перед ответом

**Что это:** Извлекать факты из предыдущего сообщения перед генерацией ответа.

**Почему отклонили:** Добавляет 3-8с к каждому ответу. Неприемлемый UX.

**Когда может быть лучше:** Если нужно использовать факт в том же ответе, где он был сказан.

### Альтернатива 2: Haiku для extraction

**Что это:** Использовать дешёвую модель для извлечения фактов.

**Почему отклонили:** Качество извлечения значительно ниже — пропускает контекстные факты, генерирует тривиальные ("пользователь задал вопрос").

**Когда может быть лучше:** При высоком трафике, когда cost становится критичным.

### Альтернатива 3: Embedding-based extraction (без LLM)

**Что это:** Извлекать факты через NLP/regex без вызова LLM.

**Почему отклонили:** Не может определить значимость факта, не может формулировать факт от третьего лица, не понимает контекст.

---

## Ссылки

- [RAG1_ROADMAP.md](../../specs/TZ_RAG_SimplyRAG/RAG1_ROADMAP.md)
- [PHASES.md](../../specs/TZ_RAG_SimplyRAG/PHASES.md)
- [ADR 039 — pgvector + Voyage AI Infrastructure](039-pgvector-voyage-ai-rag-infrastructure.md)

---

## История изменений

- **2026-04-06** — Документ создан (Claude Code, ТЗ-RAG1)
