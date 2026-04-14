# HANDOFF — TZ_ModelCatalogDocumentFlags

**Статус:** ✅ ЗАВЕРШЁН (v3.87.4, 2026-04-14)

## Что сделано

1. **Data layer:** `capabilities.documents: boolean` → `documentSupport: DocumentSupport` (discriminated union) в [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts). Все 28 записей каталога заполнены через preset-наследование + 4 override для 200K Claude. 0 consumers старого поля в проде → замена безопасна.

2. **UI:** новый `DocumentSupportBadge` в [dev-models-client.tsx](../../app/(dashboard)/dev/models/dev-models-client.tsx) с визуальной дифференциацией native/files-api/muted + расширенным tooltip.

3. **Документация:** исправлена устаревшая запись в [CLAUDE.md](../../CLAUDE.md) + [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) про Gemini 3 Flash Preview в Simply Chat — реально используется Claude Haiku 4.5 через `simply-chat-vision` taskId.

4. **CHANGELOG + bump:** v3.87.3 → v3.87.4 (patch, без breaking changes для consumers).

## Валидация
- ✅ `npx tsc --noEmit` — 0 ошибок
- ✅ `npm run build` — успешно (миграции применены, /dev/models 9.8 kB)
- ✅ Sanity check: 18 `documentSupport:` в каталоге, 0 old `documents:` (кроме JSDoc типа)

## Ключевые находки в ходе работы

1. **ТЗ был неверен в трёх местах** (верификация через WebFetch официальных docs спасла — правило #1):
   - Anthropic maxPages: 100 ≠ 600 (600 для 1M-моделей, 100 для 200K)
   - Grok Files API: декларативно есть, но в Simply не интегрирован → `false`
   - Gemini 3 Flash для Simply Chat: в коде его нет, реально Haiku 4.5

2. **`capabilities.documents` нигде не использовался** — grep нашёл 0 consumers → полная замена безопасна.

3. **Simply Chat уже имеет корректный роутинг документов** в [chat/route.ts:598-608](../../app/(chat)/api/chat/route.ts#L598): `hasAttachments(parts)` → `simply-chat-vision` → Haiku 4.5. Блокер «нужен универсальный document router» — отсутствует для этого ТЗ.

4. **Для `chatMode=expertise`/`create`** аналогичного fallback нет → silent fail если отправить PDF в Grok/MiniMax. Вне scope, в backlog.

## Backlog (отложено)

1. Universal document router для `expertise`/`create`
2. xAI Files API integration для Grok reasoning
3. Alias entries refactor (5 alias × дублирование pricing/capabilities)
4. Gemini 3 Flash Preview в каталог (если решим использовать)

## Файлы изменены

- [lib/ai/model-catalog.ts](../../lib/ai/model-catalog.ts) — тип + 5 presets + helper + все 28 entries
- [app/(dashboard)/dev/models/dev-models-client.tsx](../../app/(dashboard)/dev/models/dev-models-client.tsx) — DocumentSupportBadge
- [CLAUDE.md](../../CLAUDE.md) — version bump, Simply Chat routing correction, добавлен ТЗ в список завершённых
- [SIMPLY_STATUS.md](../../SIMPLY_STATUS.md) — version bump, корректировка Simply Chat capability, секция ТЗ
- [CHANGELOG.md](../../CHANGELOG.md) — полный entry v3.87.4
- [package.json](../../package.json) — 3.87.3 → 3.87.4

## Файлы в папке ТЗ

- [SPEC / исходный ТЗ](TZ_MODEL_CATALOG_DOCUMENT_FLAGS.md) — оригинальный документ
- [ROADMAP.md](ROADMAP.md) — все этапы закрыты
- [ANALYSIS.md](ANALYSIS.md) — верифицированные данные из официальных docs провайдеров
- [HANDOFF.md](HANDOFF.md) — этот файл

Папку можно перенести в `_archive/` после merge.
