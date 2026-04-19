# Backlog ТЗ — открытые долги и находки

> Список нерешённых задач, найденных при работе над предыдущими ТЗ.
>
> **Перед стартом нового большого ТЗ** Claude обязан пройтись по этому списку и
> предложить пользователю: «В backlog N открытых долгов: …. Хочешь сначала закрыть
> какой-то из них, или они не блокируют новый ТЗ?» Решение принимает пользователь.
>
> Этот файл и папку создаёт правило 8 WORKFLOW.md (FINDINGS → backlog).
>
> Создан: 2026-04-13
> Обновлён: 2026-04-18 — синхронизация с актуальным состоянием (убраны 6 закрытых/superseded записей) + добавлен Medium-долг TZ_UnifyContextThresholdBase (из Фазы 1 ТЗ-COMPACTION-1)

---

## Как пользоваться

- Каждый файл в этой папке — заготовка ТЗ (формат как у обычного `SPEC.md`)
- Когда поднимаем работу над долгом — файл становится исходником полноценного ТЗ:
  ```
  mkdir specs/TZ_<name>
  mv specs/_backlog/TZ_<name>.md specs/TZ_<name>/SPEC.md
  ```
  Дальше — обычный WORKFLOW (ANALYSIS → ROADMAP → код → финализация → архив)
- Если долг закрыт:
  1. Файл удаляется из `_backlog/`
  2. ТЗ уходит в `_archive/TZ_<name>/` со своим `HANDOFF.md`
  3. **Запись о закрытии добавляется в [`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md) — исторический журнал**
  4. В этом README (в секции «Открытые долги») запись УДАЛЯЕТСЯ — не дублируется в «Закрытые»

**Этот файл держит ТОЛЬКО открытые долги.** История закрытых — в `_archive/BACKLOG_CLOSED.md`.

---

## Открытые долги

### 🟥 High impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_ExpertiseCreateVisionRouting](TZ_ExpertiseCreateVisionRouting.md) | В expertise/create нет vision-routing'а на Haiku 4.5 (как в Simply через `simply-chat-vision`). Сканированные PDF (CAD/чертежи) и картинки без vision-capable модели падают с `AI_UnsupportedFunctionalityError`. Архитектурный пробел — был и до COMPACTION-1, обнаружен в smoke test Этапа B1. Решение: распространить vision-routing pattern + adaptHistoryToCapabilities на expertise/create. Vision OCR module (`lib/ai/vision-ocr.ts`) уже есть, переиспользуем. | 0.5 сессии | Smoke test ТЗ-COMPACTION-1 Этап B1 (2026-04-19) |

### 🟧 Medium impact

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_UnifyContextThresholdBase](TZ_UnifyContextThresholdBase.md) | MIND пороги (`EXTRACT_THRESHOLD_*`) считаются от `CONTEXT_BUDGET=140K`, пороги Compaction от `SIMPLY_CONTEXT_LIMIT=200K` — две разные базы в одном приложении. Production behavior не затронут, долг семантический. Решение — унифицировать на `SIMPLY_CONTEXT_LIMIT`. | 0.5 сессии | Архитектор, в процессе Compaction-1 Фаза 1 |

### 🟩 Low impact (косметика)

| ТЗ | Описание | Оценка | Источник |
|---|---|---|---|
| [TZ_UtilTitleCapReasoningMargin](TZ_UtilTitleCapReasoningMargin.md) | Cap `util:title` = 64 рассчитан на non-reasoning default. При dev override на `grok-4-1-fast-reasoning` (через `/dev/models`) safety-net обрезает финальный ответ ровно по cap (506 thinking + 64 output = 570 total, final JSON на границе). Production не затронут. Решение — поднять cap до 256 для запаса при reasoning variant. **NB:** при ТЗ-COMPACTION-1 (2026-04-19) cap уже поднят до 512 для решения проблемы #3 (autoNameChat обрывал JSON на русском) — этот долг по сути закрыт **с превышением рекомендованного значения**. Финальная проверка/закрытие при следующем backlog-review. | < 0.25 сессии | ТЗ-AISDKLayerHardening Finding #1 |
| [TZ_CompactionActualCalibration](TZ_CompactionActualCalibration.md) | Compaction формула `totalContext = system + history + new + mind + tools` доведена до ±10-15% точности (ТЗ-COMPACTION-1). После недели MVP в production — sanity-check delta нашего `estimate` vs `actual.promptTokens` из `ai_usage_log`. Если ratio за пределами 0.85-1.15 — калибровать коэффициенты `estimateTokenCount` или перейти на tiktoken-based tokenizer. Иначе закрыть как невостребованный. | 0.3 сессии (или 0 если ratio ок) | Архитектор по решению Проблемы #2 ТЗ-COMPACTION-1 |

---

## Закрытые долги

История закрытых долгов вынесена в отдельный архивный журнал:
**[`_archive/BACKLOG_CLOSED.md`](../../_archive/BACKLOG_CLOSED.md)**

Этот файл держит только открытые долги. Когда долг закрывается — запись переносится в архивный журнал, сюда не добавляется.
