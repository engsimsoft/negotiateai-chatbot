# ТЗ-TaskExpertChatInputMissingOnFirstOpen — в task expert chat пропадает поле ввода при переходе из режима планирования

**Статус:** Хвост, Medium impact
**Создано:** 2026-04-16 (сессия ТЗ-XAI-4 Этап 2, во время мануального тестирования)
**Источник:** Владимир, воспроизведено вживую
**Связано с:** [app/(chat)/projects/[id]/tasks/[taskId]/](../../app/(chat)/projects/[id]/tasks/[taskId]/), компоненты task expert chat UI

---

## Симптом

При первом входе в task expert chat **сразу после утверждения плана** (без промежуточного hard reload страницы браузера) — у AI-сообщения с первым ответом эксперта **отсутствует поле ввода** внизу экрана. Пользователь не может ответить эксперту, продолжить диалог или задать уточнение.

**Скрин 1 (до hard reload):**
- AI-эксперт вывел полный ответ на задачу (readProjectFile + webSearch, 25 секунд)
- Виден текст ответа в чате
- **Нет поля `multimodal-input` / textarea / любого input'а для сообщения пользователя** в нижней части окна
- Боковая панель с вкладкой «Задачи» видна, но в области чата — только ответ без управления

**Скрин 2 (после hard reload):**
- Тот же самый чат с тем же сообщением эксперта
- **Появляется нормальное поле ввода** внизу (с placeholder'ом, кнопкой отправки, возможностью прикрепить файл и т.д.)
- Диалог можно продолжать штатно

---

## Воспроизведение

1. Открыть проект с утверждённым планом (или создать новый проект + утвердить план)
2. Не делая hard reload, кликнуть по первой задаче в списке → перейти в task expert chat
3. Дождаться первого ответа эксперта (он вызывается автоматически с initial prompt из плана)
4. **Наблюдать:** поле ввода отсутствует
5. Сделать hard reload браузером (Cmd+R / F5)
6. **Наблюдать:** после перезагрузки поле ввода появляется, диалог работает

---

## Workaround (активный)

**Hard reload страницы** после входа в task expert chat. Это срабатывает каждый раз, но раздражает и прерывает поток работы.

---

## Impact

- **Medium** потому что workaround существует и надёжен
- **Но** ломает UX при работе с проектами — пользователь должен помнить «нажать F5 после перехода в задачу»
- Особенно раздражает при параллельном обсуждении нескольких задач подряд: каждый переход → F5 → восстановление контекста
- Регрессия от версии ТЗ-B (когда task expert chat только разрабатывался) — возможно появилась позже при оптимизациях навигации или добавлении streaming артефактов

---

## Возможные причины (гипотезы, не диагностированы)

### 1. React state не инициализируется при client-side navigation

Страница task expert chat — это Next.js client route. При переходе из `/projects/[id]` → `/projects/[id]/tasks/[taskId]` через Next.js Link / router.push — **компонент `multimodal-input` может монтироваться раньше**, чем успевает hydrated `useChat()` hook с правильным `chatId`, `initialMessages`, `status`. Hard reload = SSR prefetch → initial hydration идёт в правильном порядке.

**Где смотреть:**
- `app/(chat)/projects/[id]/tasks/[taskId]/page.tsx` — server component, передаёт пропсы
- `components/chat/` или `components/project-chat/` — client-side chat container, который рендерит input conditionally

### 2. Conditional rendering поля ввода на основе `status !== "in_progress"`

Если `useChat().status === "submitted"` / `"streaming"` — `multimodal-input` может скрываться, чтобы не дать пользователю отправить до завершения streaming. **Но после окончания streaming** state может не обновляться корректно при первом монтаже из router transition. Hard reload сбрасывает всё → initial `status === "ready"`.

### 3. Initial message передаётся через URL query или локальное состояние, а при hydration теряется

Если task expert chat получает начальный вопрос эксперту через query-parameter или server-side initial state — этот механизм может конфликтовать с client navigation, оставляя UI в промежуточном состоянии без input'а.

---

## Acceptance criteria (чтобы закрыть ТЗ)

- [ ] При навигации из `/projects/[id]` → `/projects/[id]/tasks/[taskId]` (без reload) — после завершения первого ответа эксперта **сразу появляется поле ввода**
- [ ] Hard reload даёт ровно тот же результат что client-side navigation (поведение идемпотентно)
- [ ] Регрессия не возникает при переключении между задачами подряд (задача A → задача B → задача A → …)
- [ ] Нет мерцания / пустых фреймов / input'а который появляется с задержкой > 500ms после окончания streaming

---

## Не в scope ТЗ-XAI-4

**Важно:** этот баг **НЕ связан с миграцией моделей** (ТЗ-XAI-4 трогает только `lib/ai/task-assignments.ts`). Он существовал до серии Simply_xAI. Зафиксирован во время тестирования Этапа 2 ТЗ-XAI-4 только потому, что мы активно тестировали projects workflow.

Решать — отдельным ТЗ (0.5–1 сессия). Можно объединить с `TZ_ErrorRecoveryUI` в одну сессию «project chat UI state fixes», т.к. обе касаются `useChat()` state recovery.

---

## Связанный код (первые места для исследования)

- [components/chat/](../../components/chat/) — chat container компонент
- [components/multimodal-input.tsx](../../components/multimodal-input.tsx) — поле ввода, conditional rendering
- [app/(chat)/projects/[id]/tasks/[taskId]/page.tsx](../../app/(chat)/projects/[id]/tasks/[taskId]/page.tsx) — server page, проп передача
- [app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts](../../app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts) — backend handler
