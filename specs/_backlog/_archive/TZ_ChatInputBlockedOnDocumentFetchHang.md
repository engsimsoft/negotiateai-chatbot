# TZ_ChatInputBlockedOnDocumentFetchHang

**Impact:** 🟧 medium
**Найдено:** Этап 7 ТЗ-MigrateArtifactPromptsToSkills (2026-04-27)
**Источник:** FINDINGS #3 ТЗ-MigrateArtifactPromptsToSkills

## Проблема

Когда `GET /api/document?id=...` висит в timeout (например, Neon `ConnectTimeoutError 10s`), input в чате становится **полностью недоступным** — пользователь не может ни написать сообщение, ни закрыть артефакт без F5.

## Воспроизведение (Этап 7, 2026-04-27)

В логах: `GET /api/document?id=720fd6d6-... 500 in 10856ms` (Neon ConnectTimeoutError 10s) → пользователь сообщил «не могу в чате ничего написать» при открытом артефакте. После того как фоновые document-fetches завершились — input разблокировался.

## Где код

- API route: `app/api/document/route.ts` (без timeout, ждёт Neon `getDocumentsById`)
- Клиент: подгрузка документов через `useDocument` / `useSWR` хуки в `components/artifact*.tsx`
- Связь с input: вероятно в хуке `useArtifact` или соседнем — пока loading=true, multimodal-input блокирует submit

## Гипотезы решения

1. **Timeout на artifact fetch:** поставить 5s timeout на client-side fetch, после показывать UI «не удалось загрузить артефакт, попробуй позже» — но input оставлять доступным.

2. **Расцепить input ↔ artifact loading:** input не должен зависеть от состояния загрузки артефакта. Только от состояния streaming-ответа модели.

3. **Connection retry:** Neon HTTP driver может ретраить с экспоненциальным backoff. Сейчас, видимо, single-shot 10s.

4. **Server-side timeout сократить:** 10s на одну простую SELECT-запрос — слишком много. Установить 3-5s, после ChatSDKError("temporarily_unavailable").

## Влияние

medium — проявляется только при сбоях Neon/сети, но в этот период полностью блокирует UX. Происходит регулярно у владельца (финский VPN + Neon EU-Central).

## Оценка

0.5 сессии
