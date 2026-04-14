# ROADMAP — TZ_ModelCatalogDocumentFlags

**Создано:** 2026-04-14
**Статус:** ✅ ЗАВЕРШЁН (v3.87.4, 2026-04-14)

---

## Контекст и принятые архитектурные решения

См. краткий отчёт о разведке кодовой базы и решения в [DECISIONS.md](DECISIONS.md) или ниже.

**Кратко:**
1. Существующее `capabilities.documents: boolean` в [lib/ai/model-catalog.ts:33](../../lib/ai/model-catalog.ts#L33) **не имеет ни одного консумера** в продовом коде → можно безопасно заменить
2. Simply Chat роутинг по типу attachment **уже работает** в [chat/route.ts:598-608](../../app/(chat)/api/chat/route.ts#L598-L608) — `simply-chat-vision` → `claude-haiku-4-5-20251001` (НЕ Gemini, как указано в устаревшем CLAUDE.md)
3. Gemini 3 Flash Preview в каталог НЕ добавляем — его в коде нет
4. Документный fallback для chatMode `expertise`/`create` отсутствует — это ВНЕ scope, отдельный будущий ТЗ
5. xAI Files API не интегрирован в Simply → флаги Grok ставим `false` (фактическая истина, не декларативная)

---

## Этап 0 — Изучение официальной документации (правило #1) ✅

**Цель:** независимая верификация данных из ТЗ перед записью в каталог. ТЗ говорит «верифицировано в апреле 2026», но я обязан сверить лично — это правило памяти.

- [x] WebFetch: Anthropic PDF Support — лимиты страниц, размер, методы доставки (inline base64 / URL / Files API beta)
- [x] WebFetch: xAI Files API — какие модели поддерживают, лимит размера, требования к agentic
- [x] WebFetch: Perplexity File Attachments — какие модели sonar/sonar-pro/sonar-deep-research, какие форматы
- [x] MiniMax — уже верифицировано 2026-04-14, см. [project_minimax_catalog_audit.md](../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_minimax_catalog_audit.md). Anthropic-compat НЕ поддерживает image/document
- [x] Найденные данные записаны в [ANALYSIS.md](ANALYSIS.md)
- [x] Расхождения с ТЗ зафиксированы в ANALYSIS.md (критичное — 600 vs 100 страниц для Sonnet/Opus 4.6)

**DoD:** ✅ [ANALYSIS.md](ANALYSIS.md) содержит таблицу всех 27 записей с верифицированными значениями.

---

## Этап 1 — Расширение типа ModelCapabilities ✅

**Цель:** добавить структурное поле `documentSupport` с discriminated union, удалить старое булевое `documents`.

### Файлы
- [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts)

### Действия
- [x] Создан тип `DocumentSupport` (discriminated union по `supported: boolean`)
- [x] Заменено `documents: boolean` в `ModelCapabilities` на `documentSupport: DocumentSupport`
- [x] Обновлены все 5 capability presets (`CAPS_CLAUDE`, `CAPS_MINIMAX`, `CAPS_GROK`, `CAPS_OPENROUTER_TEXT`, `CAPS_OPENROUTER_VISION`)
- [x] Создан helper `CAPS_CLAUDE_200K_DOCS` для override 200K-моделей (100 страниц вместо 600)
- [x] Все 6 индивидуальных capabilities (Voyage×2, Sonar×2, Deepgram, Gemini TTS) обновлены
- [x] `npx tsc --noEmit` → 0 ошибок

**DoD:** ✅ TypeScript компилируется. Все entries в `ENTRIES` имеют валидное `documentSupport`.

---

## Этап 2 — Заполнение флагов поштучно для каждой модели ✅

**Цель:** актуальные данные из ANALYSIS.md записаны в каталог, с корректными лимитами и notes.

Реализовано через preset-наследование. Большинство записей получают `documentSupport` через
inheritance из preset (`CAPS_CLAUDE`, `CAPS_MINIMAX`, `CAPS_GROK`, `CAPS_OPENROUTER_*`).
Override применён только там, где значение отличается от preset:

### Anthropic Claude (физические — 4 + alias — 5 = 9 записей)
- [x] `claude-sonnet-4-6` (1M) → preset `CAPS_CLAUDE` → maxPages 600, maxSizeMb 32, native
- [x] `claude-haiku-4-5-20251001` (200K) → override `documentSupport: CAPS_CLAUDE_200K_DOCS` → maxPages 100
- [x] `claude-opus-4-6` (1M) → preset → 600/32/native
- [x] `claude-sonnet-4-5-20250929` (200K legacy) → override `CAPS_CLAUDE_200K_DOCS` → 100/32/native
- [x] `claude-sonnet` alias (1M) → preset → 600/32
- [x] `claude-haiku` alias (200K) → override `CAPS_CLAUDE_200K_DOCS` → 100/32
- [x] `claude-opus` alias (1M) → preset → 600/32
- [x] `title-model` alias (Haiku, 200K) → override `CAPS_CLAUDE_200K_DOCS` → 100/32
- [x] `artifact-model` alias (Sonnet, 1M) → preset → 600/32

### MiniMax (2 записи)
- [x] `MiniMax-M2.7` → preset `CAPS_MINIMAX` → false, "Anthropic-compat endpoint не поддерживает image/document inputs"
- [x] `MiniMax-M2.7-long` → preset → то же

### xAI Grok (6 записей)
- [x] Все 6 → preset `CAPS_GROK` → false, "xAI Files API не интегрирован в Simply"
- Будущий ТЗ-XAIFilesIntegration поднимет флаг для reasoning-вариантов

### OpenRouter (5 записей)
- [x] `z-ai/glm-4.6`, `z-ai/glm-5.1`, `qwen/qwen3.6-plus` → preset `CAPS_OPENROUTER_TEXT` → false, "OpenRouter proxy — document support не валидирован, не для production"
- [x] `z-ai/glm-4.6v`, `z-ai/glm-5v-turbo` → preset `CAPS_OPENROUTER_VISION` → false, "OpenRouter proxy — vision модели обрабатывают image/video, не PDF"

### Perplexity (2 записи)
- [x] `sonar-pro` → individual capabilities → false, "Используется только через tool deepResearch — файлы не передаются в текущей интеграции"
- [x] `sonar-deep-research` → individual → false, "Deep Research agent — не используется для прямых файловых запросов в Simply"

### Не-LLM модели (4 записи)
- [x] `voyage-4`, `voyage-4-lite` → individual → false, "Embedding model"
- [x] `deepgram-nova-3` → individual → false, "Audio transcription — input is audio, not text/documents"
- [x] `gemini-2.5-flash-preview-tts` → individual → false, "TTS model — generates audio from text, not document analysis"

### Валидация
- [x] `npx tsc --noEmit` → 0 ошибок
- [x] Sanity check: 18 occurrences of `documentSupport:` в каталоге, 0 occurrences of `documents:` (кроме одного в JSDoc комментарии типа)

**DoD:** ✅ Все 28 записей имеют корректное `documentSupport`, верифицированное против ANALYSIS.md.

---

## Этап 3 — UI /dev/models показывает новый флаг ✅

**Цель:** ты как пользователь сразу видишь правильную картину document support на странице `/dev/models`.

### Файлы
- [app/(dashboard)/dev/models/dev-models-client.tsx](../../app/(dashboard)/dev/models/dev-models-client.tsx)

### Действия
- [x] Удалена `documents` из массива `CAPABILITIES` (булевые флаги)
- [x] Создан новый компонент `DocumentSupportBadge` — отдельный, потому что `documentSupport` это discriminated union
- [x] Tooltip показывает: `method` + `maxPages` + `maxSizeMb` + `notes` для supported, `reason` для not supported
- [x] Визуальная дифференциация: native = foreground (тёмная), files-api = amber-500 (жёлтая), not supported = muted
- [x] Badge встроен в `CapabilityBadges` после булевых иконок
- [x] `npx tsc --noEmit` → 0 ошибок (после Этапа 1+2+3 прошло одним заходом)

**DoD:** ✅ Иконка 📄 на /dev/models корректно отражает новое поле, tooltip даёт детали.

---

## Этап 4 — Регрессионная проверка ✅

- [x] `npx tsc --noEmit` → 0 ошибок
- [x] `npm run build` → exit code 0 (пользователь дал approval). `tsx lib/db/migrate && next build`: миграции применились, 158 pages/routes собраны, `/dev/models` 9.8 kB
- [x] Логики роутинга Simply Chat не трогали — регрессия по факту невозможна

**DoD:** ✅ TS компилируется, build успешен, /dev/models пересобран с новым компонентом.

---

## Этап 5 — Финализация ✅

- [x] Обновлён [project_minimax_catalog_audit.md](../../.claude/projects/-Users-mactm-Projects-NegotiateAI-Chatbot/memory/project_minimax_catalog_audit.md) — пункт 5 помечен как реализованный в TZ_ModelCatalogDocumentFlags
- [x] Обновлён [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — версия 3.87.3 → 3.87.4, исправлена таблица Simply Chat capability (Gemini 3 Flash → Claude Haiku 4.5), добавлена детальная секция плана развития
- [x] Обновлён [CHANGELOG.md](../../CHANGELOG.md) — entry v3.87.4 с полным контекстом, Key Decisions, ошибками исходного ТЗ, валидацией, Out of Scope
- [x] Обновлён [CLAUDE.md](../../CLAUDE.md) — version header 3.87.3 → 3.87.4, Simply Chat routing строка исправлена (Haiku вместо Gemini 3 Flash + ссылка на chat/route.ts), добавлен ТЗ первой строкой в список «Завершены»
- [x] Обновлён [package.json](../../package.json) — 3.87.3 → 3.87.4
- [x] Создан [HANDOFF.md](HANDOFF.md) — краткое резюме для следующих сессий и архивации
- [ ] (опционально, не блокирует) ADR `docs/decisions/0XX-document-support-discriminated-union.md` — не написан, решение компактно зафиксировано в CHANGELOG «Key Decisions» секции, отдельный ADR избыточен для patch-уровня изменения

**DoD:** ✅ ТЗ закрыто, статус обновлён везде, CHANGELOG bump, папку ТЗ можно перенести в `_archive/`.

---

## Открытые вопросы для будущих ТЗ (не блокируют этот)

1. **Universal document router** для chatMode `expertise`/`create` — если пользователь шлёт PDF в Grok/MiniMax, нужен fallback. Сейчас silent fail.
2. **xAI Files API integration** — реализовать загрузку → file_id → передача в messages для Grok reasoning моделей. Поднять флаг в каталоге после.
3. **Gemini 3 Flash Preview** — добавить в каталог если решим использовать как multimodal fallback (сейчас не используется).
4. **Alias entries refactor** — устранить дублирование `pricing`/`capabilities` в alias через резолв через `aliasOf`. Техдолг.
