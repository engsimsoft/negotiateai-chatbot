# Передача сессии ТЗ-LegacyChatCleanup

**Дата:** 2026-04-13
**Сессия:** 1 (закрытие ТЗ)
**Статус:** ✅ ЗАВЕРШЁН — все 3 этапа пройдены, мануальный тест подтверждён, БД очищена, документация обновлена.

## Статус этапов

- [x] **Этап 1**: Реестр моделей и API (commit `620730b`)
- [x] **Этап 2**: Физические удаления маршрутов, страниц, навигации (commit `620730b`)
- [x] **Этап 3**: SQL cleanup БД, документация, FINDINGS → follow-up ТЗ

## Ключевые результаты

- Удалено: маршруты `/chat`, `/chat/[id]`, страница `/chats`, мёртвый компонент `context-indicator.tsx`, deprecated compatibility layer prompt builder
- Добавлено: taskId `expertise` (Grok 4.20 Multi-Agent), `create` (MiniMax M2.7); zod enum `chatMode` сужен до `simply | expertise | create`; mode-aware default title в новых ветках
- Исправлены 5 костылей в коде, 8 находок зафиксированы в FINDINGS.md
- БД: 10 legacy чатов + 107 сообщений + 196 связанных записей удалены через одноразовый tsx-скрипт. Verify = 0
- Документация: обновлены `CLAUDE.md`, `docs/ai-chats-map.md`, `SIMPLY_STATUS.md` (v3.85.0 → 3.86.0)
- WORKFLOW.md: новое **Правило 8 — FINDINGS.md** (родилось из этого ТЗ)

## Следующие действия для будущих сессий

ТЗ закрыт, переноса в `_archive/` ждёт согласования с пользователем. Перед архивацией:

1. **Финальный git commit** для всех изменений Этапа 3 (БД cleanup script был удалён, но папка ТЗ + правки документации не закоммичены)
2. **Обсудить с пользователем приоритет 5 follow-up ТЗ** из FINDINGS.md
3. **Перенести папку**: `mv specs/TZ_LegacyChatCleanup/ _archive/`

## Follow-up ТЗ (из FINDINGS.md)

| Приоритет | ТЗ | Файл | Impact |
|---|---|---|---|
| 1 | TZ_DeadModelSelectors | удаление `lib/ai/models.ts` + 5 dead импортёров | medium |
| 2 | TZ_UsageLoggingCoverage | покрыть фоновые вызовы Haiku в `ai_usage_log` | medium |
| 3 | TZ_StreamObservability | заменить молчаливый `onError: () => "Oops"` | medium |
| 4 | TZ_CreateSnapshotAudit | проверить мёртв ли `createSnapshot` для проектов | medium |
| 5 | TZ_GrokContextWindowAudit | эмпирическая проверка реального contextWindow Grok | low |

## Блокеры / Вопросы

Нет блокеров. Все запланированные задачи выполнены, мануальный тест пройден.
