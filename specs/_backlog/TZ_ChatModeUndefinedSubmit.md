# TZ_ChatModeUndefinedSubmit

**Impact:** 🟥 high
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** FINDINGS #6 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

Runtime error при попытке отправить сообщение в Simply Chat когда в холсте открыт **существующий** артефакт:

```
Runtime Error
getChatUrl: неизвестный chatMode "undefined". Допустимые: simply | expertise | create | (с projectId — project chat). Возможно вы пытаетесь открыть legacy-чат удалённого режима "chat".
```

Пользователь физически не может писать в чат — input заблокирован. F5 помогает временно.

## Где код

- **Throw site:** [lib/utils.ts:92](lib/utils.ts#L92) — `getChatUrl` намеренно throw-ит на unknown chatMode (ТЗ-LegacyChatCleanup, чтобы не молча 404).
- **Caller:** [components/multimodal-input.tsx:196](components/multimodal-input.tsx#L196) — `window.history.replaceState({}, "", getChatUrl(chatId, chatMode))` в `submitForm`.
- **Контракт пропа:** [components/multimodal-input.tsx:86](components/multimodal-input.tsx#L86) — `chatMode?: string` (опциональный, TS не возражает на отсутствие).

## Call stack (из скриншота владельца)

```
getChatUrl                          lib/utils.ts:92:13
PureMultimodalInput.useCallback[submitForm]  components/multimodal-input.tsx:196:53
onSubmit                            components/multimodal-input.tsx:402:11
form                                <anonymous>
```

## Гипотезы решения

1. **TS-fix контракта (рекомендую):** изменить `chatMode?: string` → `chatMode: string` (без `?`) в `MultimodalInputProps`. TS заставит всех родителей передать значение. Найти где артефакт-pane не передаёт.

2. **Defensive в submitForm:**
   ```ts
   if (!chatMode) {
     console.error("[MultimodalInput] chatMode is undefined, skipping URL update");
     // skip replaceState, продолжать sendMessage
   } else {
     window.history.replaceState({}, "", getChatUrl(chatId, chatMode));
   }
   ```
   Не блокирует submit, но не обновляет URL.

3. **Fallback default:** `getChatUrl(chatId, chatMode ?? "simply")` — если URL уже на `/simply`, пустой mode = simply. Но это маскирует root cause.

## Воспроизведение

1. Открыть `/simply`
2. Создать артефакт через AI (любой kind)
3. После открытия артефакта в холсте — попытаться отправить сообщение
4. → Runtime error overlay блокирует UI

## Влияние

high — артефакты постоянно открыты в Simply UI, в этом state пользователь не может писать. Происходит на текущем master.

## Оценка

0.5 сессии (TS-fix + найти проблемный родитель + регресс-тест)
