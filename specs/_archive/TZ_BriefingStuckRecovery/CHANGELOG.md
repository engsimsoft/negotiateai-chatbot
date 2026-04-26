# Changelog ТЗ-BriefingStuckRecovery

> Локальный лог сессий по этому ТЗ. После закрытия ТЗ запись о результате уйдёт в главный CHANGELOG.md.

## Сессия 1 — 2026-04-25

### Created
- `SPEC.md` (поднят из `specs/_backlog/TZ_BriefingStuckRecovery.md`)
- `ANALYSIS.md` — изучена документация Drizzle 0.45 + Vercel Cron Hobby; зафиксированы расхождения SPEC ↔ код (cron daily не hourly; catch-блок есть; `getBriefingHistory` фильтрует по 'ready'; `deleteOldBriefingHistory` уже самоочищает stuck при success); 5 вопросов владельцу
- `ROADMAP.md` — 4 этапа: watchdog + UPSERT-refactor + UI-баннер + финализация
- `HANDOFF.md`

### Этап 1 — ✅ закрыт 2026-04-26
- `STUCK_THRESHOLD_MINUTES=10` в briefing-config.ts
- `markStuckBriefingsAsFailed({userId?, thresholdMinutes})` в queries.ts (idempotent, non-blocking, returns count)
- Watchdog подключён в **4 точках**: cron (sweep), `/api/briefing/latest` GET (defense, orphan endpoint — см. FINDINGS #1), `/briefing` page server component, `/dashboard` page server component
- **Расширение scope vs ROADMAP:** добавлен watchdog в `/dashboard` page — оказался **корнем UX-блока**, карточка «Утренний брифинг» при stuck-записи рендерилась non-clickable (`Loader2 + "Генерируется..."`). Без watchdog в dashboard юзер не мог даже зайти на /briefing → page-watchdog не срабатывал

### Validated
- Мануальный тест 2026-04-26: вставил синтетическую `generating` запись 15-min-old → owner открыл /dashboard → лог `[markStuckBriefingsAsFailed] Marked 2 stuck row(s) as failed` (моя + старая реальная) → SQL подтвердил `status='failed'` + watchdog metadata → карточка ожила → owner перешёл на /briefing успешно
- `npx tsc --noEmit` зелёный

### Findings
- `FINDINGS.md` — orphan endpoint `/api/briefing/latest` (никем не вызывается; кандидат на удаление в follow-up)

### Этап 2 — ✅ закрыт 2026-04-26
- `updateBriefingHistory({id, ...})` в queries.ts — отдельный явный helper (не перегруз saveBriefingHistory)
- pipeline.ts: `briefingId` объявлен ДО try-блока (доступен из catch), захватывается из первого INSERT'а через `initialRow.id`
- 3 финальные ветки переписаны на UPDATE: no-items (строка ~171), success (~328), catch (~365)
- catch имеет fallback на старый INSERT если первый INSERT упал и briefingId = undefined

### Validated (этап 2)
- Мануальный тест 2026-04-26: pipeline через override на Grok 4.1 Fast → 39.5с → SQL: **одна** row для vladimir со status='ready' (старый код создал бы две)
- `npx tsc --noEmit` зелёный

### Этап 3 — ✅ закрыт 2026-04-26
- `lastAttemptFailed` + `lastErrorMessage` props добавлены в BriefingPageClient
- Server: `/briefing/page.tsx` дополнительно делает `getBriefingHistory({limit:1})` (без status-фильтра) → флаг = (latest.status === 'failed')
- Client: красноватый inline-баннер `border-destructive/30 bg-destructive/5` между header и content с иконкой ⚠️, текстом ошибки и кнопкой «Запустить заново» (вызывает существующий startGeneration)
- Без shadcn Alert (не плодим компоненты)

### Validated (этап 3)
- Мануальный тест 2026-04-26: вставил синтетический failed row → owner увидел баннер с error message → нажал «Запустить заново» → pipeline 37.5с → SQL: одна свежая ready row, синтетический failed row удалён через `deleteOldBriefingHistory({keepLast:1})` → баннер исчез
- `npx tsc --noEmit` зелёный

### Этап 4 — ✅ закрыт 2026-04-26 (финализация)
- package.json 3.99.0 → 3.99.1 (patch)
- Главный CHANGELOG.md обновлён записью 3.99.1
- SIMPLY_STATUS.md: версия + footer + блок «Известные проблемы» (TZ_BriefingStuckRecovery убран, добавлены TZ_BriefingMiniMaxHang High и TZ_ExpertiseReasoningRestore Medium и TZ_BriefingConcurrencyGuard Medium)
- _backlog/README.md синхронизирован
- _archive/BACKLOG_CLOSED.md: добавлена запись о закрытии TZ_BriefingStuckRecovery
- 2 новых backlog: TZ_BriefingMiniMaxHang.md (High, найден в session), TZ_BriefingConcurrencyGuard.md (Medium, B5 ANALYSIS)
- Откат `.simply-dev-overrides.json` (костыль с briefing:author/section→Grok снят)
- AUDIT_BRIEFING.md создан для архитектора (запрос пришёл в финализации)

### Найденные хвосты
- FINDINGS.md: orphan `/api/briefing/latest` endpoint (никем не вызывается, кандидат на удаление в follow-up)
- AUDIT_BRIEFING.md § 4.1: 🟥 critical MiniMax briefing:author silent hang (отдельный backlog TZ_BriefingMiniMaxHang)
- AUDIT_BRIEFING.md § 4.2-4.4: P2/P3 хвосты briefing pipeline (publishedAt missing, Хабр RSS 404, saveBriefingProfile non-transactional, hardcoded tier domains, нет URL-валидации при ручном редактировании)
- AUDIT_BRIEFING.md § 5: связь Briefing с общими интернет-инструментами Simply (для архитектора, проектирование Блока 8)
