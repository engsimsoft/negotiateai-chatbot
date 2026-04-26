# Находки ТЗ-BriefingStuckRecovery

> Список нерешённых проблем, обнаруженных во время работы над ТЗ.
> После закрытия ТЗ — оформить как follow-up задачу (Правило 8 WORKFLOW).

## 🚩 Finding #1: orphan endpoint `/api/briefing/latest`

**Где:** [app/(chat)/api/briefing/latest/route.ts](../../app/(chat)/api/briefing/latest/route.ts)
**Что:** Endpoint существует, авторизован, грузит `getBriefingHistory({status:"ready"}) + getBriefingSettings`, отдаёт JSON. **Никем не вызывается** в кодовой базе (`grep -rn "api/briefing/latest"` — 0 hits в client/server коде, кроме моих свежих комментариев).
**Почему проблема:** Мёртвый код. При работе над ТЗ-BriefingStuckRecovery я добавил туда `markStuckBriefingsAsFailed` — но эта точка не сработает в продакшене, никто этот endpoint не дёргает. Реальный entry point — server component `/briefing/page.tsx`. Watchdog перенесён в page.tsx (Этап 1), вызов в latest/route.ts оставлен как defense-in-depth на случай будущего использования endpoint'а.
**Предлагаемое решение:** удалить `app/(chat)/api/briefing/latest/route.ts` целиком в follow-up ТЗ. Перед удалением — `git log --diff-filter=D` подтвердить что endpoint никогда никем не звался (возможно был удалён вызывающий клиент). Если дёргается из telegram-бота / внешнего скрипта — оставить.
**Влияние:** low (мёртвый код, не баг)
**Обнаружено:** Этап 1, при попытке мануального теста watchdog — открытие `/briefing` не триггерило watchdog потому что page бьёт в БД напрямую через `getBriefingHistory`, а не через latest endpoint.
