# TZ_ErrorRecoveryUI — Восстановление UI после stream error

**Статус:** Backlog, высокий приоритет
**Создано:** 2026-04-15 (после 9-го напоминания от Владимира)
**Блокирует:** ежедневное тестирование, любую сессию где streamText падает с AI SDK ошибкой

---

## Проблема

После того как AI SDK streamText бросает ошибку (например `AI_UnsupportedFunctionalityError`, `AI_APICallError`, `AI_InvalidArgumentError`), в UI появляется красный флаг с ошибкой — **и после этого невозможно отправить следующее сообщение в том же чате**. Инпут не реагирует, кнопка Send не активна, или отправка происходит но сразу блокируется повторной ошибкой.

**Единственный способ восстановиться:** перезагрузить страницу браузера (Cmd+R / Ctrl+R). После перезагрузки useChat state resets → чат снова работоспособен.

## История проблемы

- **Возникала минимум 9 раз** в разных ТЗ. Владимир напоминал каждый раз. Проблема откладывалась из сессии в сессию, backlog-запись не создавалась → забывалась → воспроизводилась → цикл повторялся
- **ТЗ-StreamObservability (v3.87.2)** был частичной попыткой фикса: `ObservabilityOnErrorHandler + RecoveryUX`. В нём: server-side console.error + emitDebugError в обоих chat routes, локализованная user-facing строка вместо «Oops», Stage 2b — prop-drill `clearError` из `useChat` → `MultimodalInput`, submit guard сужен до `streaming/submitted`, disabled attrs фиксированы. AI SDK v6 docs требуют explicit `clearError` перед resend.
- **Почему не сработал полностью:** `clearError` срабатывает для некоторых ошибок, но есть классы ошибок которые оставляют useChat state в «залипшем» состоянии (видимо когда ошибка вылетает внутри onError и не через стандартный error channel). Конкретно `AI_UnsupportedFunctionalityError` из @ai-sdk/xai про `file part media type text/plain` воспроизвёл проблему 2026-04-15 в ТЗ-XAI-3 smoke-тестах
- **Это процессный провал** — не отсутствие решения, а отсутствие дисциплины бэклога. Каждый раз проблема фиксировалась устно, записи не велось → забывалась → воспроизводилась

## Минимальный фикс (Stage 1 — приоритет)

**Предложение Владимира (2026-04-15):**
> В красном флаге с ошибкой добавить явный user-facing текст: «Перезагрузите страницу браузера (Cmd+R / Ctrl+R) чтобы продолжить диалог». Минимум это снимет ощущение тупика.

**Анализ:**
- ✅ **Принимается как Stage 1.** Это не root-cause fix, это **минимизация ущерба** до root-cause решения. Чёткий message → пользователь знает что делать → не сидит в тупике. Работает здесь и сейчас
- ✅ **Изменения локальны** — надо найти компонент показывающий error state в `components/`, добавить строку + возможно кнопку «Перезагрузить страницу» с `window.location.reload()`
- ⚠️ **НЕ ЗАМЕНЯЕТ root-cause** — после Stage 1 всё равно нужен Stage 2 где useChat state правильно восстанавливается без reload
- ⚠️ **Не портит UX добавленной кнопки** — появляется только при ошибке, дефолтный flow не меняется

**Эстимейт Stage 1:** 15-30 минут работы + smoke test. Отдельное micro-ТЗ.

## Root cause fix (Stage 2 — после Stage 1)

Выяснить почему `clearError()` из useChat не восстанавливает state для определённых классов ошибок. Возможные направления:
1. Проверить версию `ai` package + изучить changelog `useChat` error handling после v6
2. Проверить что `onError` в нашем коде возвращает правильный signal (не swallow'ит error)
3. Проверить что client error bus (`reportClientError` / `subscribeToClientErrors`) не конфликтует с useChat internal state
4. Воспроизвести в isolated sandbox → понять различие между «восстановимой» и «залипшей» ошибкой
5. Возможно нужен polish в `DevPanelErrorBoundary` или в submit guard логике

## Репродукция (2026-04-15)

1. Открыть Simply Chat, создать новый диалог
2. Прикрепить текстовый файл (`test.txt`) и отправить запрос про содержимое
3. Получить ответ
4. Нажать кнопку «Думать» в том же чате
5. Отправить сложный запрос
6. **Ожидается:** запрос улетает → Grok 4.20 обрабатывает → ответ приходит
7. **Происходит:** `AI_UnsupportedFunctionalityError: 'file part media type text/plain' functionality not supported` → красный флаг в UI → инпут блокируется → **reload требуется**

**Note:** в ТЗ-XAI-3 после фикса регрессии `inlineTextFileParts` → `convertTextFilesInAllMessages` эта конкретная ошибка исчезнет. Но **паттерн «error → UI заблокирован» остаётся** — другие классы ошибок будут воспроизводить тот же блок.

## Приоритет

**Высокий.** Блокирует любую сессию разработки/тестирования где streamText может упасть. Отсутствие proper recovery = отсутствие возможности продолжить диалог без потерь. Нужно сделать в одном из ближайших ТЗ после серии Simply_xAI.

**Не в scope ТЗ-XAI-3** — не хочется расширять текущий ТЗ скоупом из другой области. Но backlog-запись создана, больше не забудется.

## Ссылки

- [ТЗ-StreamObservability v3.87.2](../../CHANGELOG.md) — предыдущая частичная попытка
- [lib/client/error-bus.ts](../../lib/client/error-bus.ts) — client error bus infrastructure (если существует)
- [components/dev-panel/dev-panel-error-boundary.tsx](../../components/dev-panel/dev-panel-error-boundary.tsx) — React class boundary
