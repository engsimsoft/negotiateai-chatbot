# ТЗ-2: Dev Switchboard UI — страница /dev/models + интеграция в DevPanel

**Версия:** v3.82.0 → v3.84.0
**Зависимости:** ТЗ-1 (Core Registry) — `registry.ts`, `model-catalog.ts`, `task-assignments.ts`, `getModel(taskId)`

---

## Цель

Дать разработчику мгновенный контроль над всеми моделями и overrides прямо во время тестирования.
Страница `/dev/models` — полная карта системы.
Быстрый переключатель встроен в существующий DevPanel (чтобы менять модель → сразу отправлять сообщение в чате без переключения вкладок).

---

## Что создать

### 1. Страница `/dev/models` (Server Component + Client interactivity)

- Доступ **только** в development (`SIMPLY_DEV_MODE=true`)
- Три секции:
  1. **Карта назначений** (основная таблица всех ~40 taskId)
     - taskId + описание
     - Текущая модель (dropdown — все модели + warning-иконка при несовместимости)
     - Провайдер + статус ENV-ключа (✅/❌ + последние 4 символа)
     - Capabilities иконки (👁 vision, 🔧 tools, 💭 thinking и т.д.)
     - Pricing (RUB/1K input-output)
     - Кнопка «Apply override» (cookie + localStorage)
  2. **LLM Providers** (5 namespaces: anthropic, minimax, minimaxLong, xai, openrouter)
  3. **Raw Providers** (voyage, deepgram, perplexity, google TTS)
  4. **Каталог всех моделей** (из `model-catalog.ts`)

- Dropdown показывает **все** модели (включая несовместимые с warning-иконкой).

### 2. Быстрый Model Switcher в DevPanel

- Новая секция **«Model Switchboard»** внутри существующего `DevPanelDrawer` (per-message).
- Компактная версия: показывает задачу текущего сообщения (если известна) и позволяет менять модель.
- Live-применение: меняешь модель → следующий запрос использует override → видно в footer.
- Кнопка «Reset all overrides».

### 3. Механика overrides

- `getModel(taskId)` первым делом проверяет:
  1. Cookie `x-model-overrides` (JSON) — через `next/headers` внутри `lookupOverride`
  2. localStorage (для UI — только отображение / source of truth в cookie)
  3. Defaults из `task-assignments.ts`
- В production (`SIMPLY_DEV_MODE !== "true"`) cookie полностью игнорируется.
- Overrides сохраняются между перезагрузками (cookie + localStorage).
- Overrides — per-browser (не per-user в БД).

---

## Что изменить

- Добавить секцию «Model Switchboard» в `DevPanelDrawer`.
- Обновить `getModel(taskId)` — реализовать `lookupOverride()` через `next/headers` cookies + dev-gate + try/catch.
- В DevPanel footer показывать badge «OVERRIDE» если для задачи этого сообщения стоит override.
- Footer уже показывает `data.finish.modelId` (фактическая модель из step events) — ничего менять не надо.

---

## Ограничения

- Никаких изменений в основном UI приложения (только dev-инструменты).
- Поведение в production остаётся 100% прежним (dev-gate на всех уровнях).
- Overrides работают **только** при `SIMPLY_DEV_MODE=true`.

---

## Архитектурные решения (согласовано с архитектором)

1. **Cookie-подход для lookupOverride** — через `next/headers` внутри функции. Ноль изменений в 35+ call-sites `getModel()`.
2. **Capability-фильтр** — вариант C: все модели в dropdown + warning-иконка при несовместимости. Никакого `TASK_REQUIREMENTS`.
3. **Placement Switchboard** — вариант C: полная карта на `/dev/models` + per-message компактный switcher внутри `DevPanelDrawer`.
4. **Overrides scope** — только cookie + localStorage (dev-only), без БД.
5. **Реестр провайдеров** — две отдельные секции: LLM Providers (5) и Raw Providers (3).
6. **«Apply override»** — сразу сохраняет + тост + undo 3–5 секунд.

---

## Тестирование

1. Открыть `/dev/models` → увидеть полную карту.
2. Переключить модель для `simply-chat` через dropdown → отправить сообщение → в footer badge «OVERRIDE» + новая модель.
3. Переключить `simply-chat-vision` → загрузить файл → проверить модель.
4. Перезагрузить страницу → overrides сохраняются.
5. В production (`SIMPLY_DEV_MODE=false`) — `/dev/models` → 404, cookie игнорируется.
6. Кнопка «Reset all» — все overrides сбрасываются, следующий запрос использует defaults.

---

**Источник:** Сообщение от архитектора, 2026-04-12
