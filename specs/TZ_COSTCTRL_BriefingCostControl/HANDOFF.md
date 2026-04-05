# Передача сессии ТЗ-COSTCTRL

**Дата:** 2026-04-05
**Сессия:** 1

## Статус этапов
- [ ] Phase 0: Emergency data repair ← ТЕКУЩИЙ
- [ ] Phase 1: Service layer + API invariant
- [ ] Phase 2: UI state machine fix
- [ ] Phase 3: Fail-fast cron pipeline
- [ ] Phase 4: Guaranteed usage logging (waitUntil + cron_run_log)
- [ ] Phase 5: Complete cost coverage
- [ ] Phase 6: Admin cost-audit endpoint
- [ ] Финализация

## Следующая сессия: начни с
1. Read ROADMAP.md → Phase 0
2. Выполнить SQL-аудит invalid state users
3. UPDATE для остановки cost leak

## Контекст
- Фаза 1 (Анализ) завершена, все 7 вопросов закрыты
- 4 дефекта найдены в БД production (факты в SPEC.md)
- vladimir@family.local — invalid state (deliveryEnabled=true без Telegram)
- julia@family.local — correct state (deliveryEnabled=false + Telegram)
- Cron работает каждое утро, генерирует undeliverable content на ~$0.15/день

## Ключевые решения
- Cascade on Telegram disconnect: ДА
- Auto-repair в cron: ДА
- Defense-in-depth (UI + API): ДА
- Точное pricing Deepgram/TTS: ДА (per-minute / per-character)

## Блокеры / Вопросы
- Phase 4 `waitUntil` нельзя мануально проверить локально — нужен Vercel preview deployment
