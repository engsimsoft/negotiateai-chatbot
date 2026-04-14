# Закрытые долги backlog — архивный журнал

> Исторический журнал всех долгов из `specs/_backlog/`, которые были закрыты.
> Пополняется только при закрытии долга. Источник — `specs/_backlog/README.md`.
>
> **Для подробностей** по каждому закрытому долгу — читать `HANDOFF.md` в соответствующей папке `_archive/TZ_<name>/`.
>
> Создан: 2026-04-14

---

## Журнал

| ТЗ | Закрыто в | Как |
|---|---|---|
| TZ_UsageLoggingCoverage | 2026-04-13 (TZ_UnfreezePipelines v3.86.1) | Слит в `TZ_CachePipelineMetrics` — обе задачи трогают одни и те же pipeline-файлы, раздельное выполнение было бы двойной работой |
| TZ_OpenRouterCostTracking | 2026-04-13 (v3.87.1) | Root cause оказался не namespace prefix (первая гипотеза) а version suffix от OpenRouter. Walk-back loop в `getModelEntry` делает lookup tolerant к versioned IDs |
| TZ_StreamObservability | 2026-04-14 (v3.87.2) | Server-side `onError` в обоих chat routes: console.error + emitDebugError через closure-captured writer + локализованная user-facing строка. Stage 2b расширил скоуп на recovery UX: prop-drill `clearError` из useChat → MultimodalInput |
| TZ_CreateSnapshotAudit | 2026-04-14 (v3.87.3) | SQL audit: 2 all-time calls, 0 через project task expert, 1 failed из 2. Fully deleted — 4 файла, 4 queries, 2 schema columns (migration 0054). ADR 052 «Context Management Strategy per Provider» документирует 4-уровневую стратегию |
| TZ_DeadModelSelectors | 2026-04-14 (`9ddf814`, `a1923b1`, `5b2571c`) | **Закрыто частично** (~30% scope). Удалены 3 legacy selector-файла + упрощён `entitlements.ts`. Попутно закрыт pre-existing bug override в проектных task-чатах (`9ddf814`). Остальные ~70% намеренно оставлены владельцем — `ModelSelectorCompact` в проектах сохраняется. Первая попытка Этапа 1 (коммит `772e886`) откачена `git reset --hard` после HMR incident. Внесено 2 новых находки: `prompts.ts` 90% dead (Finding #1), scattered side-effect imports (Finding #2, позже признан ошибочным) |
| TZ_OverridesReaderCentralization | 2026-04-14 (сессия 3, `fdcd9f7`, 0 коммитов в код) | **Закрыто как «ошибочно заведено»**. Finding #2 из TZ_DeadModelSelectors был сформулирован как production-concern для dev-only фичи (`/dev/models`). Попытка переноса side-effect import в `instrumentation.ts` провалилась при мануальном тесте и полностью откачена. Постскриптум добавлен в ADR 048. Правило: **перед заведением находки сверять с ADR — если ADR декларирует ограничение, отсутствие покрытия за пределами ограничения это реализация дизайна, не долг** |
