# TZ_SimplyChatLoadPerf

> ✅ **СТАТУС: РАЗМОРОЖЕН 2026-04-28** — TZ_SimplyChatBillingLeak partial-fix применён ([HANDOFF](../_archive/TZ_SimplyChatBillingLeak/HANDOFF.md)), остаток уйдёт через Шаг 4 миграции. Этот TZ возвращён в работу как quick win перед продолжением миграции. См. [TRIAGE.md](../_backlog/TRIAGE.md) блок A.

**Impact:** 🟥 high — пользователь жалуется на 15-22 сек открытие /simply прямо сейчас.
**Origin:** выделено из [_backlog/TZ_SimplyChatUiScaling.md](../_backlog/TZ_SimplyChatUiScaling.md) (пункты C+D). Остальное (A virtualization, B pagination) остаётся в backlog до 500+ сообщений. Пункт E (compaction divider) вынесен в отдельное микро-ТЗ.
**Создано:** 2026-04-28 после серии измерений Network tab + dev-логов.

## Проблема

`/simply` открывается 15-22 секунды на проде. Замеры (локальный dev, после прогрева компиляции, 342 msg / 66K токенов):

| Что | Цифра | Архитектурная причина |
|---|---|---|
| `GET /simply` дублируется | 2× RSC рендер + 2× `[Token Aware]` 342 msg | Клиент делает второй RSC fetch на mount |
| 8 параллельных `/api/document` | 513-2828 ms каждый, wall-clock ~3 сек | `<DocumentPreview>` для каждого артефакта в истории делает `useSWR` сразу при mount, без проверки viewport |
| `/api/user/profile`, `/api/vote`, `/api/auth/session` ×6 | 1-2.7s суммарно | Параллельные клиентские fetch-и в waterfall |

**Прод-цифры (из жалоб владельца):** 14810ms / 22339ms / 3019ms на `GET /simply` 200. Серверная часть (RSC + `getMessagesByChatId`) — лишь часть; основной вклад — клиентский waterfall artifacts + дубль RSC.

## Scope (что делаем)

### C. Дедупликация загрузки `/simply`

**Симптом:** `[Token Aware] Loaded ALL 342 messages` логируется 2 раза подряд за один открытый таб → двойной serialization 342 сообщений в RSC payload + 2× DB hit.

**Цель:** `getMessagesByChatId` для одного открытия `/simply` вызывается **ровно один раз** на серверной стороне.

**Подход (требует анализа в Фазе 1):**
- Найти причину второго RSC-запроса (`useSession()` refresh? `useAutoResume`? `router.refresh()`?)
- Если StrictMode dev-only — проверить что на prod вызов один (curl + лог).
- Если есть реальный лишний `router.refresh()` / `useSession({ refetchOnMount })` — убрать или закэшировать.
- В крайнем случае: обернуть `getMessagesByChatId` в `React.cache()` для дедупликации в рамках одного RSC render.

### D. Lazy loading артефактов

**Симптом:** При открытии чата на 342 msg → 8 одновременных `GET /api/document?id=...` (все артефакты, которые когда-либо были созданы в чате). Каждый — отдельный DB-запрос + JSON блоб.

**Цель:** `/api/document?id=...` запрашивается только когда `<DocumentPreview>` попадает в viewport (intersection observer).

**Подход:**
- В [components/document-preview.tsx:53](../../components/document-preview.tsx#L53) обернуть `useSWR` гейтом `inView` через `react-intersection-observer` или нативный `IntersectionObserver`.
- Пока артефакт ниже скролла — не fetch'ить, показывать compact placeholder с `result.title` (он уже есть в tool-result, не требует /api/document).
- При скролле к артефакту → SWR активируется → артефакт подгружается.
- Уже видимые артефакты (последние 1-2 сообщения) — fetch немедленно.

## Out of scope (НЕ делаем в этом ТЗ)

- Virtual scroll (`@tanstack/react-virtual`) — в backlog `TZ_SimplyChatUiScaling`.
- Cursor pagination + «Старее» — там же.
- Compaction visual divider — отдельное микро-ТЗ `TZ_SimplyCompactionDivider`.
- Оптимизация `/api/user/profile` (1-2.7s) — побочное наблюдение, не часть waterfall fix'а. Если найду тривиальный root-cause — отдельной находкой в FINDINGS.md.
- Снижение частоты `useSession()` вызовов — побочное, FINDINGS.md.
- Фикс blob storage SocketError на `_next/image` — внешняя проблема Vercel Blob.

## Критерии готовности

1. **C:** В dev-логах при открытии `/simply` блок `[Token Aware] Loaded ALL N messages` появляется **один раз** (не два).
2. **D:** В Network tab при открытии `/simply` (342 msg, 8 артефактов) делается ≤ 2 запроса `/api/document?id=...` (только видимые в viewport). Остальные подгружаются по мере скролла.
3. **TTI** (визуальное появление чата с историей): сокращение в 2-3 раза по dev-замерам, измеримо до/после на одном тестовом чате.
4. `npx tsc --noEmit` — 0 ошибок.
5. Мануальный тест владельца: открывает /simply, проверяет что все артефакты по-прежнему доступны (lazy fetch при скролле), скорость открытия субъективно лучше.
6. Один коммит на ТЗ (Правило 7).

## Файлы (предполагаемые)

- `app/(chat)/simply/page.tsx` — возможно `cache()` или анализ дубля
- `components/chat.tsx` — поиск источника второго RSC fetch (useAutoResume? useSession?)
- `components/document-preview.tsx` — IntersectionObserver gate для useSWR
- `package.json` — возможно зависимость `react-intersection-observer` (если нет нативного)

## Связанные документы

- [specs/_backlog/TZ_SimplyChatUiScaling.md](../_backlog/TZ_SimplyChatUiScaling.md) — родительский долг (после этого ТЗ урезан до A+B)
- [specs/_backlog/TZ_SimplyCompactionDivider.md](../_backlog/TZ_SimplyCompactionDivider.md) — UX-долг compaction разделителя
