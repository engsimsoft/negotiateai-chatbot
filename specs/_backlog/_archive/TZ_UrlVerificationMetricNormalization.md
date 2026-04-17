# ТЗ-UrlVerificationMetricNormalization — дальнейшая очистка метрики fabricated URLs

**Статус:** Хвост, Low impact (основной фикс уже в `58d9d2e`, это follow-up hardening)
**Создано:** 2026-04-16 (follow-up после основного фикса в той же сессии)
**Источник:** Эмпирический инцидент метрики `fabricated` 82-91% на реальных briefings (см. [SIMPLY_XAI_NOTES.md](../Simply_xAI/SIMPLY_XAI_NOTES.md) 2026-04-16 «Correction: URL hallucination была не галлюцинацией»)
**Связано с:** [lib/ai/pipeline-trace.ts](../../lib/ai/pipeline-trace.ts), [_backlog/_archive/TZ_BriefingAuthorUrlHallucination.md](_archive/TZ_BriefingAuthorUrlHallucination.md) (superseded), commit `58d9d2e`

---

## Контекст

Основной фикс — `normalizeUrlForComparison()` — уже в production commit `58d9d2e`:
- Strip hash fragments
- Strip tracking params (`utm_*`, `fbclid`, `gclid`, `ref`, `mc_*`, `yclid`, `_ga`, `igshid`, `msclkid`)
- Lowercase hostname + strip `www.`
- Protocol → https
- Sort remaining query params
- Strip trailing slash
- Malformed URL → graceful fallback

Smoke test подтвердил: OLD метрика 88% fabricated → NEW 25% (control cases с реально выдуманными URL). Это **достаточно** для продуктовой корректности DevPanel — метрика больше не врёт.

Этот хвост — **дальнейшая очистка**, не критично для продукта. Можно отложить.

---

## Scope: 3 пункта

### 1. Unit test suite (вместо удалённого disposable smoke test)

**Проблема:** текущий фикс валидирован через disposable `scripts/test-url-verification-normalization.ts`, удалённый после прохождения. Регрессия возможна.

**Решение:** Vitest/Jest test file `lib/ai/__tests__/pipeline-trace.test.ts` (если нет test harness — ещё меньший scope: переписать disposable как keepable скрипт и документировать в README).

Набор тест-кейсов минимум:
- Anchor fragment removal (`#atom-everything`, `#comments`)
- UTM params removal (все 9 tracking prefixes)
- Preserve legitimate query params (`?page=2`, `?id=abc`)
- Sort query params for stable comparison
- Trailing slash normalization
- www. / без www.
- http → https
- Lowercase hostname (uppercase source)
- Malformed URL graceful fallback
- Control: genuinely different URLs **не должны** матчиться

### 2. Tracking params audit — проверить полноту списка

**Текущий regex:** `/^(utm_|fbclid$|gclid$|yclid$|mc_|ref$|_ga$|igshid$|msclkid$)/`

**Стоит проверить на реальных briefings:** какие ещё tracking params приходят от текущих источников пользователей (Habr, Telegram, Simon Willison, etc.). Возможно упущены:
- `from=` (распространённое на российских сайтах)
- `si=` (Spotify, YouTube)
- `feature=` (YouTube)
- `amp=` (Google AMP)
- Habr-специфичные (если есть кроме UTM)

Подход: SQL-запрос на `BriefingHistory.briefingJson` и `ai_usage_log`, собрать все уникальные query-параметры, глазами отсортировать «tracking» vs «legitimate content».

### 3. ADR / документация для normalizeUrlForComparison

**Проблема:** правило «как правильно сравнивать URL в observability» не задокументировано в ADR. Следующий разработчик может продублировать наивный `Set.has(url)` в другом месте.

**Решение:**
- Либо обновить [docs/decisions/030-pipeline-observability.md](../../docs/decisions/030-pipeline-observability.md) с разделом «URL verification: canonical comparison»
- Либо новый ADR-055 «URL normalization contract for observability metrics»
- Либо добавить заметный комментарий + пример в [lib/ai/pipeline-trace.ts](../../lib/ai/pipeline-trace.ts) (уже сделано в commit `58d9d2e` JSDoc — возможно достаточно)

---

## Acceptance criteria

- [ ] Unit test suite покрывает 9+ edge cases
- [ ] Tracking params regex расширен по результатам SQL audit **или** подтверждено что текущий достаточен
- [ ] ADR или inline-docs контракт задокументирован
- [ ] `npx tsc --noEmit` → 0 ошибок
- [ ] Нет регрессии на реальном briefing (генерация + проверка urlVerification)

---

## НЕ в scope

- Изменение самой логики нормализации — она уже работает, 8/8 smoke test PASS
- Замена `generateObject` + `z.enum([...allowedUrls])` — это было предложение из superseded [TZ_BriefingAuthorUrlHallucination](_archive/TZ_BriefingAuthorUrlHallucination.md) и **оно не нужно** (реальной проблемы нет)
- Миграция briefing:author / briefing:section на Grok — отдельный вопрос ТЗ-XAI-6 cleanup, решается после того как Владимир скажет «да, качество OK, убираем MiniMax из registry»

---

## Оценка

**0.5 сессии** если есть test harness в проекте, **1 сессия** если придётся поднимать Vitest/Jest для первого теста.
