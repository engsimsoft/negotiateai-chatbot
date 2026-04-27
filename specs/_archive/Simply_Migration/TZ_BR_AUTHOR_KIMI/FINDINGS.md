# Находки ТЗ-BR-AUTHOR-KIMI

> Список нерешённых проблем, обнаруженных во время работы над ТЗ.
> После закрытия ТЗ — оформить как follow-up задачу в `specs/_backlog/`.

---

## 🚩 Finding #1: Устаревшая metadata в промпте `briefing-scriptwriter.md`

**Где:** `lib/prompts/briefing/briefing-scriptwriter.md:4-6`
**Что:** Header промпта содержит фактически неверную metadata:
- Строка 4: `**Модель:** MiniMax M2-Her (специализация: мульти-персонажные диалоги)`
- Строка 6: `**Где:** Пайплайн: Автор (MiniMax M2.7) → **Сценарист (эта роль)** → MiniMax Speech 2.8 HD TTS → MP3`

После миграции BR-AUTHOR-KIMI модель — Kimi K2.6 (Instant mode), не MiniMax. Также упоминание «MiniMax Speech 2.8 HD TTS» — стек TTS не пересматривался в этом ТЗ, нужна отдельная проверка актуальности (вероятно используется другой TTS — Gemini TTS или Deepgram).
**Почему проблема:** Промпт целиком уходит в system message модели. Kimi видит «ты MiniMax M2-Her» — это вранье о её identity. Не критично (главные инструкции дальше в промпте), но непрофессионально для production prompt и создаёт путаницу при PE-ревью.
**Предлагаемое решение:** PE-сессия — обновить header metadata на актуальный стек (Kimi K2.6 + текущий TTS-провайдер). SPEC ТЗ-BR-AUTHOR-KIMI явно запретил трогать промпты («Промпты в `lib/prompts/briefing/` не трогаем»), поэтому правка вне scope этого ТЗ.
**Влияние:** low (cosmetic/professionalism, не функциональный баг)
**Обнаружено:** Этап 5 (зачистка комментариев), grep по `MiniMax\|minimax\|MINIMAX` в финальной проверке
