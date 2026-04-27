# Changelog ТЗ-RAG0: Simply RAG — Инфраструктура

## Сессия 1 — 2026-04-06

### Added
- SPEC.md, ANALYSIS.md, ROADMAP.md, PHASES.md — полная документация
- pgvector extension v0.8.0 в Neon PostgreSQL
- Таблица `memory_entry` с vector(1024) + HNSW-индекс + 4 составных индекса
- `lib/ai/memory/voyage-client.ts` — Voyage AI клиент (embed + batch)
- `lib/ai/memory/memory-queries.ts` — CRUD + similarity search
- `lib/ai/memory/types.ts` — типы (MemoryCategory, SearchOptions, VoyageEmbedResponse)
- `lib/ai/memory/index.ts` — public API
- Voyage pricing в providers.ts
- VOYAGE_API_KEY в .env.example + .env.local
- ADR 039: pgvector + Voyage AI
- Обновлены: CHANGELOG, SIMPLY_STATUS, CLAUDE.md, ai-providers.md, package.json

### Verified
- E2E: insert 3 факта → search (similarity 0.64-0.70) → supersede → delete all
- tsc: 0 ошибок, build: успешен

### Decisions
- 5 фаз вместо 2 (RAG-0 → RAG-4)
- varchar(32) вместо pgEnum для category
- Raw fetch вместо SDK для Voyage AI
- decayScore и accessCount убраны из RAG-0
- RLS отложен, начинаем с WHERE-фильтра
- HNSW: дефолтные параметры (m=16, ef_construction=64)
- Изображения: MIND через Claude Vision (текстовые факты), Библиотека через voyage-multimodal-3.5
