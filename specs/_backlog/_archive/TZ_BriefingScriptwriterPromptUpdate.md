# ТЗ-BriefingScriptwriterPromptUpdate — обновить metadata в промпте подкаст-сценариста

**Статус:** Хвост, **Low impact** (косметика, не функциональный баг)
**Создано:** 2026-04-27 в Этапе 5 ТЗ-BR-AUTHOR-KIMI (вынесен из scope)
**Связано с:**
- [lib/prompts/briefing/briefing-scriptwriter.md:4-6](../../lib/prompts/briefing/briefing-scriptwriter.md#L4)
- ТЗ-BR-AUTHOR-KIMI закрыто в v3.99.2 (миграция briefing pipeline с MiniMax на Kimi K2.6)

---

## Контекст

После ТЗ-BR-AUTHOR-KIMI весь `briefing:podcast-script` taskId работает на Kimi K2.6 (Moonshot AI, Instant mode). Промпт сценариста остался без правок — SPEC явно запретил трогать промпты в `lib/prompts/briefing/`.

В результате header промпта содержит фактически неверную metadata:

```markdown
**Модель:** MiniMax M2-Her (специализация: мульти-персонажные диалоги)
**Где:** Пайплайн: Автор (MiniMax M2.7) → **Сценарист (эта роль)** → MiniMax Speech 2.8 HD TTS → MP3
```

**Проблема:**
1. Промпт целиком уходит в system message модели. Kimi видит «ты MiniMax M2-Her» — это вранье о её identity. Не критично (ключевые инструкции дальше в промпте), но непрофессионально для production prompt и создаёт путаницу при PE-ревью.
2. Также упоминание «MiniMax Speech 2.8 HD TTS» — стек TTS не пересматривался в ТЗ-BR-AUTHOR-KIMI, нужна отдельная проверка актуальности (вероятно используется Gemini TTS — `gemini-2.5-flash-preview-tts` через `lib/podcast/tts-gemini.ts`, multi-speaker Host=Kore + Expert=Iapetus).

## Что предлагается

PE-сессия — обновить header metadata на актуальный стек:

```markdown
**Модель:** Kimi K2.6 (Moonshot AI, Instant mode — мульти-персонажные диалоги)
**Где:** Пайплайн: Автор (Kimi K2.6) → **Сценарист (эта роль)** → Gemini TTS → MP3
```

Точные имена/версии — сверить с актуальными `lib/podcast/script-generator.ts` + `lib/podcast/tts-gemini.ts` на момент работы над ТЗ.

## Acceptance criteria

- [ ] `lib/prompts/briefing/briefing-scriptwriter.md:4` — указана текущая модель (Kimi K2.6 или актуальная на момент)
- [ ] `lib/prompts/briefing/briefing-scriptwriter.md:6` — pipeline отражает реальный стек (Author + TTS)
- [ ] `pnpm exec tsc --noEmit` зелёный (на промпт-файлы tsc не реагирует, формальная проверка)
- [ ] Smoke-тест подкаста: `briefing:podcast-script` генерит диалог корректного формата (Host/Expert lines)

## НЕ в scope

- Изменение основного содержания промпта (инструкции, примеры) — только metadata header
- Стек TTS не пересматривать — описать как есть в коде на момент ТЗ
- Изменение Russian/English баланс инструкций — это отдельная задача PE-команды

## Оценка

**0.1-0.2 сессии:**
- Чтение текущего стека (briefing/podcast call-sites): 5 минут
- 2-3 строки правки в .md: 5 минут
- Smoke-тест: 5 минут
