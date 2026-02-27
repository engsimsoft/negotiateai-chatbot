# ТЗ-FIX3: Восстановление инструментов create mode

**Приоритет:** Критический  
**Суть:** Вернуть create mode те же 5 инструментов и 30 шагов что у edit mode. Причина галлюцинаций была в maxSteps=10 на процесс требующий 20+, а не в инструментах.

---

## 1. route.ts — единый набор инструментов

**Файл:** `app/(chat)/api/service-chat/route.ts`

Убрать разделение tools по режимам. Оба режима получают одинаковые 5 инструментов:
- `deepResearch` (defaultDepth: "pro")
- `fetchUrl`
- `readTelegramChannel`
- `updateBriefingPreview`
- `saveBriefingProfile`

Конкретно:
- Убрать `if (isCreateMode)` ветку с `startResearch` из tools
- Убрать `if (!isCreateMode)` обёртку вокруг deepResearch/fetchUrl/readTelegramChannel
- Убрать `verifiedSourceUrls` Set — больше не нужен
- Убрать `progressRef` — без startResearch прогресс стримится через стандартный tool activity

**НЕ удалять:**
- `startResearch` tool definition — закомментировать (нужен для TG4 cron)
- `research-engine.ts` — оставить как есть
- `ResearchProgressCard` компонент — оставить, не рендерится без startResearch events

## 2. maxSteps — одинаковый для обоих режимов

Было:
```
const maxSteps = context === "briefing-onboarding"
  ? (briefingMode === "edit" ? 30 : 10)
  : 3;
```

Нужно:
```
const maxSteps = context === "briefing-onboarding" ? 30 : 3;
```

## 3. Промпт — убрать startResearch, добавить последовательность

**Файл:** `lib/prompts/service-chats/briefing-onboarding.md`  
**Версия:** v10 → v11

### tools_usage
Единый список инструментов для обоих режимов. Убрать секцию `startResearch (только create)` целиком.

### Шаги интервью — заменить упоминания startResearch:

**Шаг 3**: если пользователь дал ссылку → `fetchUrl` для проверки, если @username → `readTelegramChannel`. Запомнить результат.

**Шаг 7**: для каждой темы **по очереди**: `deepResearch` (одна тема = один вызов) → из результатов выбрать 3-5 источников → `fetchUrl` каждый → битые отбросить → следующая тема.

**Шаг 8**: показать пользователю проверенные источники → `updateBriefingPreview` → спросить подтверждение.

**Шаг 9**: корректировки — убрать/добавить/переискать через соответствующий инструмент → `updateBriefingPreview`.

### tool_rules — добавить:
```
Один инструмент за один шаг. Вызвал → дождался → обработал → следующий.
deepResearch — одна тема за вызов. Не вызывай для всех тем разом.
```

### self_check — заменить "startResearch" на "deepResearch":
```
0. Каждый факт об источнике — из какого вызова deepResearch или fetchUrl я его узнал?
1. Называю ли я источник который НЕ из deepResearch / fetchUrl и НЕ от пользователя? → Убери.
```

### Заголовок:
```
Изменения v11: Единый набор инструментов для обоих режимов.
Убран startResearch из диалога — AI работает последовательно: deepResearch → fetchUrl.
Явное правило: один инструмент за шаг, одна тема за вызов.
```

## Не трогать

- `research-engine.ts` — для будущего TG4 cron
- `perplexity-client.ts` — используется deepResearch
- Guardian (FIX1/FIX1.2) — работает независимо как страховка
- Edit mode — не трогать, работает
- `injectDevMode()` — оставить

## Критерий приёмки

1. Create mode: AI ведёт собеседование — спрашивает темы, уточняет
2. deepResearch по одной теме → fetchUrl для проверки источников → следующая тема
3. Презентация проверенных источников → updateBriefingPreview
4. "Сохрани" → saveBriefingProfile (НЕ startResearch)
5. Весь процесс последовательный, без галлюцинаций
