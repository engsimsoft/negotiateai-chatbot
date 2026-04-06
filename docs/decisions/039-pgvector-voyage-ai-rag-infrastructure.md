# ADR 039: pgvector + Voyage AI — RAG Infrastructure

**Дата:** 2026-04-06
**Статус:** Принято
**ТЗ:** RAG-0 (v3.70.0)

## Контекст

Simply строит два слоя персонального интеллекта:
- **MIND** — долговременная память из разговоров
- **Библиотека** — база знаний из документов пользователя

Нужна инфраструктура для vector search: хранение эмбеддингов, similarity search, embedding API.

## Решение

### pgvector в Neon PostgreSQL
- Extension v0.8.0, поддерживается Neon нативно
- HNSW-индекс для approximate nearest neighbor search
- Не требует отдельного vector DB (Pinecone, Weaviate) — всё в той же PostgreSQL

### Voyage AI как единый embedding-провайдер
- Рекомендован Anthropic для embeddings
- Один API-ключ закрывает: embeddings, contextualized embeddings, reranking, multimodal
- Shared embedding space: voyage-4 (indexing) + voyage-4-lite (queries) — разные модели, одно пространство
- Размерность 1024 (Matryoshka-совместим — можно уменьшить без переиндексации)

### Raw fetch вместо SDK
- Voyage REST API простой (один endpoint)
- В проекте уже 3 провайдера на raw fetch (Perplexity, Jina, Deepgram)
- Единообразие паттернов важнее convenience SDK

### Drizzle customType для vector
- Drizzle не имеет нативного типа vector
- customType с toDriver/fromDriver для number[] ↔ pgvector format
- Similarity search через raw SQL (`<=>` cosine distance operator)

## Причины

1. **Один провайдер:** Было 3 (OpenAI embeddings + Cohere rerank + Gemini enrichment) → стал 1 (Voyage AI)
2. **Без нового сервиса:** pgvector живёт в той же Neon PostgreSQL, не нужен Pinecone/Weaviate
3. **Shared space:** Индексируем voyage-4, ищем voyage-4-lite — дешевле на 66% при поиске
4. **Масштабируемость:** HNSW работает до ~10M записей, Matryoshka позволяет уменьшить размерность

## Альтернативы

| Вариант | Почему отклонён |
|---------|----------------|
| Pinecone / Weaviate | Новый сервис, дополнительная зависимость, стоимость |
| OpenAI embeddings | Не в экосистеме Anthropic, нет shared space, нет reranking |
| Voyage SDK (npm) | Недостаточно зрелый, raw fetch проверенный паттерн в проекте |
| pgEnum для category | В проекте 0 pgEnum-ов, varchar(32) + Zod гибче |
| RLS с первого дня | Drizzle не поддерживает SET per-request нативно, WHERE-фильтр надёжнее |

## Последствия

**Плюсы:**
- Единая инфраструктура для MIND и Библиотеки
- Минимум новых зависимостей (только VOYAGE_API_KEY)
- Паттерн повторяется в будущих фазах (RAG-1 → RAG-4)

**Минусы:**
- Similarity search через raw SQL (не через ORM) — менее type-safe
- Free tier Voyage AI: 3 RPM без payment method (поднимается после добавления)
- HNSW-индекс занимает storage в Neon
