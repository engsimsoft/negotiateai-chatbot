# Анализ ТЗ_SimplyChatLoadPerf

## Изученная документация

**В рамках задачи внешние SDK не затронуты.** Используем уже подключённые в проекте технологии:

- **SWR** ([package.json](../../package.json) → `swr`) — уже используется для `useSWR(/api/document?...)` и `useSWR(/api/vote?...)`. Идиома гейта через условный ключ `useSWR(condition ? key : null)` штатная и **не требует доп. библиотеки** для отложенного fetch.
- **IntersectionObserver** — нативный API. В проекте уже используется в [components/briefing/briefing-article-view.tsx:82](../../components/briefing/briefing-article-view.tsx#L82) как scroll spy. Берём такой же паттерн без новых зависимостей.
- **Next.js 15 RSC behavior** — гипотеза о двойном RSC fetch требует проверки на prod (см. вопрос Q1 ниже). Не угадываю по памяти.

## Резюме

Чат `/simply` грузится 15-22 сек. Замеры выявили две архитектурные причины: (C) `getMessagesByChatId` вычитывает 342 сообщения **дважды** на одно открытие и (D) при mount чата параллельно запрашиваются **8 артефактов**, ни один из которых ещё не виден пользователю.

Клиент `/api/document?id=...` вызывается из [components/document-preview.tsx:53](../../components/document-preview.tsx#L53) — `useSWR` запускается сразу при mount каждого `<DocumentPreview>`, без проверки видимости. Решение архитектурно простое: гейт по `inView`.

С (C) сложнее: источник второго RSC-фетча не очевиден из кода. `useAutoResume` ([hooks/use-auto-resume.ts](../../hooks/use-auto-resume.ts)) НЕ виновник — он только зовёт `resumeStream()`, без `router.refresh()`. Кандидаты: NextAuth `useSession()` (видим 3-6 запросов `/api/auth/session` на одно открытие), Next.js dev mode prefetch, или какой-то `router.refresh()` в `useChatVisibility` / `data-stream-handler`. Нужно подтверждение измерением.

## Изученные файлы

| Файл | Что увидел |
|---|---|
| [app/(chat)/simply/page.tsx](../../app/(chat)/simply/page.tsx) | Один вызов `getMessagesByChatId({ id: simplyChat.id })` без cache(). RSC передаёт `uiMessages` в `<Chat>` через props. |
| [components/chat.tsx](../../components/chat.tsx) | `useChatVisibility`, `useChat`, `useAutoResume`, `useSWR(/api/vote?...)`. Нет очевидного `router.refresh()`. |
| [hooks/use-auto-resume.ts](../../hooks/use-auto-resume.ts) | Только `resumeStream()` если последнее msg от user. НЕ trigger'ит RSC refetch. |
| [components/document-preview.tsx](../../components/document-preview.tsx) | `useSWR(result ? \`/api/document?id=${result.id}\` : null, fetcher)` — fires on mount. **Точка фикса для D.** |
| [lib/db/queries.ts:507-607](../../lib/db/queries.ts) | `getMessagesByChatId` без `cache()` обёртки — повторный вызов = повторный SQL + парсинг. |

## Вопросы для согласования

### Q1. Как искать источник второго RSC fetch /simply (пункт C)?

**Гипотезы (по убыванию вероятности):**

- **H1 — Dev-only артефакт.** React 19 + Next.js 15 dev mode иногда прелоадит RSC payload дважды. На prod вызов один.
- **H2 — `useSession()` NextAuth.** На страницах с `/api/auth/session` 3-6 раз есть подозрение что NextAuth дёргает session refresh, что иногда влечёт RSC refetch.
- **H3 — `useChatVisibility` или другой клиентский хук** делает `router.refresh()` или mutate'ит SWR-ключ страницы.

**Предлагаемый порядок проверки в Фазе 3 (этап C):**

1. Открыть `/simply` на **prod** (`https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app/simply`) с DevTools Network. Если там `/simply` запрашивается **один раз** → H1, dev-only, не чиним (или делаем `cache()` обёртку для подстраховки).
2. Если на prod тоже два раза → grep по `router.refresh()` / `mutate(unstable_serialize` / `useSession({ refetchOn`.
3. Найденный виновник — целевая правка. Если виновник архитектурно нужен (например, `useSession()` для auth-state), решение через `cache()` в RSC.

**Вопрос владельцу:** OK такой план «измерь сначала на prod, потом чини»? Или идём напрямую делать `React.cache()` обёртку для подстраховки?

### Q2. Сколько артефактов fetch'ить eagerly (не дожидаясь viewport)?

**Варианты:**

- **a)** 0 — все через IntersectionObserver. Минимально fetch'ей, но при первой отрисовке пользователь видит N карточек-плейсхолдеров (быстро заменяемых после fetch при scroll).
- **b)** Последние **3** артефакта в чате (по позиции message в массиве). Гарантирует что нижний край чата (виден сразу при открытии) уже подгружен.
- **c)** Артефакты в последних **5 сообщениях** (учёт того что у одного message может не быть артефакта).

**Рекомендация:** **(b)**. Простая эвристика, гарантированно покрывает то что юзер видит сразу при открытии (chat scroll attached to bottom через `useStickToBottomContext`).

**Вопрос владельцу:** OK на варианте (b)?

### Q3. Скоуп этого ТЗ — только C+D, без побочных оптимизаций?

В замерах видны **побочные тяжёлые fetch-и**, не относящиеся напрямую к C/D, но утяжеляющие waterfall:

- `/api/user/profile` 1075-2778ms (зачем 2.7 сек на профиль?)
- `/api/auth/session` × 6 за один прогон (NextAuth полинг?)
- `/api/vote?chatId=...` 1026-1936ms (DB query на каждое голосование?)

**Рекомендация:** Не лезть. Записать в **FINDINGS.md** этого ТЗ, оформить отдельным backlog-долгом в Фазе 4. Иначе scope разрастается.

**Вопрос владельцу:** Согласен оставить эти 3 fetch-а вне scope?

## Потенциальные риски

| # | Риск | Митигация |
|---|---|---|
| R1 | Lazy fetch ломает UX «открыл чат — увидел старый артефакт сразу» | rootMargin 200-400px у IntersectionObserver — артефакты предзагружаются за чуть до попадания в viewport |
| R2 | `cache()` для `getMessagesByChatId` сломает повторные использования в `/api/chat` route | `cache()` действует только в рамках одного RSC render. В route handler (`/api/chat`) это никак не влияет. Безопасно. |
| R3 | Виновник C — что-то критичное (auth flow), нельзя просто отключить | Тогда фикс через `React.cache()` обёртку — устраняет дубль на сервере без ломки клиентского поведения. |
| R4 | IntersectionObserver requires hydration → первый кадр всё равно покажет fetch для всего | Mitigation: при mount проверяем `boundingBox` сразу через `getBoundingClientRect`, активируем SWR для тех что уже в viewport |

## Зависимости

- Никаких блокирующих. ТЗ self-contained.
- Параллельные ТЗ в backlog (`TZ_DocumentTruncationSilent`, `TZ_EstimatorIgnoresAttachments` и др.) не пересекаются.

## Оценка сложности

- [ ] Простое (1-2 сессии)
- [x] **Среднее (1.5-2 сессии)** — диагностика причины C может занять время; D — UI рефактор + IntersectionObserver, тестируется на разных устройствах
- [ ] Сложное

**Разбивка:**
- Этап C (дубль RSC): 0.5-1 сессия (зависит от того, что обнаружится на prod)
- Этап D (lazy artifacts): 0.5-1 сессия (документ-превью + edge cases)
- Финализация (тесты, коммит, обновление docs): 0.2 сессии

**Готов к Фазе 2 (составление ROADMAP) после ответов на Q1, Q2, Q3.**
