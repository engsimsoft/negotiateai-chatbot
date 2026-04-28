# Анализ ТЗ — Simply_Migration · Шаг 3 · Vision/OCR cleanup

**SPEC:** [SPEC.md](SPEC.md) (от архитектора, канонический)
**ROADMAP:** [ROADMAP.md](ROADMAP.md) (от архитектора, 6 фаз)
**Дата:** 2026-04-28

---

## Резюме

Удалить мёртвый `vision:ocr` (taskId + файл `lib/ai/vision-ocr.ts`), переключить default `chat-vision` с Claude Haiku 4.5 на Grok 4.1 Fast non-reasoning. Anthropic полностью уходит из vision-пути в чате.

---

## Изученная документация (Правило 1)

| Источник | Дата проверки | Ключевые факты |
|---|---|---|
| [docs.x.ai — Image Understanding](https://docs.x.ai/docs/guides/image-understanding) | 2026-04-28 | Форматы: **JPG/PNG only**. Max **20 MiB**. Base64 + URL поддерживаются. Лимит изображений на запрос не указан. |
| WebSearch — Grok 4.1 Fast specs | 2026-04-28 | **Context window: 2 000 000 токенов** (НЕ 128K). Pricing: **$0.20 input / $0.50 output**, cached input cheaper. Vision support: yes. |
| [npm @ai-sdk/xai](https://www.npmjs.com/package/@ai-sdk/xai) | 2026-04-28 | Latest = **3.0.83**. Установлено в проекте `^3.0.83` (`package.json`) — апдейт не нужен. |
| [docs.x.ai — Models](https://docs.x.ai/developers/models) | 2026-04-28 | `grok-4-1-fast-non-reasoning` существует, latency-sensitive variant. PDF как файл — **не поддерживается** (только image). |

**Knowledge cutoff моей модели = январь 2026** — все факты выше получены через WebFetch/WebSearch, не по памяти.

---

## Backlog проверка (Правило 9)

`specs/_backlog/README.md`: **4 deferred ТЗ**, ни один не блокирует Шаг 3 и не пересекается с vision/OCR-областью:
- TZ_MindAtomicityFix · TZ_SimplyChatUiScaling · TZ_SimplyCompactionDivider · TZ_BriefingConcurrencyGuard

**Решение:** не блокирует, продолжаем Шаг 3.

---

## Phase 1 audit — выполнен (read-only)

Сводка фактов, собранных до создания этого файла. Все проверки повторно не нужны.

| Проверка | Результат |
|---|---|
| **Call sites `vision:ocr` / `vision-ocr` / `extractTextFromImage` / `extractTextFromPDF`** | 0 внешних. Всё локально в [vision-ocr.ts](../../../lib/ai/vision-ocr.ts) и [task-assignments.ts](../../../lib/ai/task-assignments.ts) (строки 22, 80, 237, 337, 416). Удаление безопасно. |
| **`grok-4-1-fast-non-reasoning` в [model-catalog.ts:392-400](../../../lib/ai/model-catalog.ts#L392-L400)** | ✅ Запись есть. vision=true (через `CAPS_GROK`). Pricing $0.20/$0.50 ✅. ⚠ **contextWindow=128_000 — расхождение с docs.x.ai (2M).** См. [FINDINGS.md](FINDINGS.md). |
| **`task-assignments.ts`** | `chat-vision` = `claude-haiku-4-5-20251001` ✓ · `vision:ocr` = `claude-haiku-4-5-20251001` ✓ |
| **UI `/dev/models`** | 0 hits для `vision:ocr` в `app/`. Рендерится из реестра — почистится автоматически. |
| **Незакоммиченный `lib/ai/registry.ts`** | Диагностический PAYLOAD-DEBUG fetch wrapper из ТЗ-SimplyChatBillingLeak (ADR-057). **НЕ относится к Шагу 3** — не смешиваем. |
| **PDF-fallback path** | `lib/pdf/extract-pdf-text.ts` (pdf-parse v2). **Растеризации НЕТ** (`pdf-poppler/pdf2pic/pdfjs` — 0 hits). При сканах Haiku сейчас получает PDF as-is через native PDF support; после миграции Grok → `adaptHistoryToCapabilities` подменит на текст-плейсхолдер. **R3 подтверждён.** |
| **docs/ai-chats-map.md** | Строки для обновления: 13, 21, 49, 427, 586, 589, 598, 612. |
| **docs/ai-providers.md** | Строки для обновления: 83, 106, 133, 139. |

---

## Код-ревью архитекторского ТЗ (Senior Dev Review)

### ✅ Согласен

- **Скоуп.** Минималистичный и атомарный. Не лезет в PDF pipeline (это Шаг 4) — правильно.
- **R3 как known limitation.** Не делать rasterize PDF→JPG как заплатку — соответствует Правилу `feedback_no_bandaids` и принципу проекта «не изобретать своё». Шаг 4 закроет архитектурно.
- **Capability-driven routing не трогаем.** `resolveActiveTaskId` остаётся как страховка для dev-override через `/dev/models`.
- **Незакоммиченный `registry.ts` не смешивать** — это диагностика чужого ТЗ.
- **Структура фаз** (audit → cleanup → migration → manual tests → docs → commit) — эталонная.

### ⚠️ Рекомендую дополнить

| # | SPEC говорит | Реальность кода | Действие |
|---|---|---|---|
| 1 | SPEC §4.1: «Контекст модели: 2M токенов» | [model-catalog.ts:398](../../../lib/ai/model-catalog.ts#L398): `contextWindow: 128_000` | **Phase 3.1 расширить:** обновить `contextWindow: 128_000 → 2_000_000`. Подтверждено WebSearch 2026-04-28. То же самое для `grok-4-1-fast-reasoning` (строка 388) — единый бренд, единый контекст. Запишу в FINDINGS до коммита. |
| 2 | SPEC §6.4: «vision capability и pricing корректные» | Поле в проекте называется **`vision: boolean`** в `ModelCapabilities` (model-catalog.ts:66). У `CAPS_GROK` `vision: true` ✅ | Архитектор уточнил вопрос про точное имя флага — отвечаю: `capabilities.vision`. Дополнительных правок не требуется. |
| 3 | SPEC §7.2 / ROADMAP §4.2: fallback test | На текущий момент **все активные модели в каталоге vision-capable** (Grok-серия, Claude-серия, OpenRouter Vision-серия, Gemini). Текстовая модель без vision = только OpenRouter text — но они не в активных taskId | **Фиксирую N/A в VERIFICATION.md как явный choice** (по совету архитектора 2026-04-28), не блокирует приёмку. |

### ❓ Вопросов нет.

---

## Потенциальные риски (помимо SPEC §5)

Все риски R1-R7 из SPEC по-прежнему актуальны. Phase 1 audit разрешил R1, R4, R5, R7 (нулевые). Остаются:
- **R2 (vision capability)** — зелёный: запись есть, vision=true. Только contextWindow надо подправить (см. рекомендацию 1).
- **R3 (сканы PDF)** — подтверждён, принят как known limitation до Шага 4.
- **R6 (capability-driven routing edge cases)** — поймём в Phase 4.

---

## Зависимости

- ТЗ-1 (BR-AUTHOR-KIMI), ТЗ-2 (MigrateArtifactPromptsToSkills) — **закрыты** ✅
- Блокирует **Шаг 4 (PDF на xAI Files API)** — после Шага 3 R3 будет жить в backlog до Шага 4

---

## Оценка сложности

- [x] **Простое** (1-2 часа, 1 PR, один атомарный коммит)
- [ ] Среднее
- [ ] Сложное

---

## Решение

**Старт Phase 2 (Cleanup)** после одобрения владельца. Идём строго по архитекторскому [ROADMAP.md](ROADMAP.md), с одной поправкой: **в Phase 3.1 дополнительно обновить `contextWindow` обеих Grok 4.1 Fast записей в каталоге на 2M**.
