# MiniMax M2.7 — Интеграция в Simply

**Статус:** ✅ Внедрена и проверена в production
**Версия проекта:** 3.82.0
**Дата последнего аудита:** 2026-04-10

> Этот документ — единственный источник правды по MiniMax M2.7 в Simply.
> ADR: [043-minimax-simply-routing.md](decisions/043-minimax-simply-routing.md), [046-podcast-tts-revert-and-briefing-stability.md](decisions/046-podcast-tts-revert-and-briefing-stability.md)

## История миграций

- **v3.77.0** — MiniMax M2.7 для Simply Chat (text)
- **v3.80.0 (ТЗ-Briefing-1)** — Briefing Filter + Author переведены с Gemini/Sonnet на MiniMax M2.7. Цена брифинга: $0.074 → $0.011 (6.6×)
- **v3.81.0 (ТЗ-Briefing-2)** — Podcast Script + TTS переведены на MiniMax (Speech 2.8 HD)
- **v3.82.0 (ТЗ-MapReduce)** — TTS откачен на Gemini Flash TTS (качество хуже + 53× дороже). Script остался на M2.7. Map-Reduce для Author отклонён (sequential streamText socket bug — монолит стабилен на 26K+ tokens)

---

## 1. Зачем MiniMax M2.7

| Параметр | Haiku 4.5 (было) | MiniMax M2.7 (сейчас) |
|----------|-------------------|------------------------|
| Intelligence Index | 31 | 50 (уровень Opus) |
| Input | $0.80/M | $0.30/M |
| Output | $4.00/M | $1.20/M |
| Cache Read | $0.08/M (ручная настройка) | $0.06/M (автоматический) |
| Реальная стоимость сообщения | ~$0.005 | ~$0.001 |
| Настройка кэша | Явный `cache_control` | Ноль конфигурации |

**Итог:** в 3-5 раз дешевле, в 1.6 раза умнее, кэш из коробки.

---

## 2. Архитектура подключения

```
chatMode=simply (текст)     → MiniMax M2.7, thinking OFF
chatMode=simply (вложения)  → Gemini 3 Flash (vision)
chatMode=simply (Думать)    → Anthropic Sonnet (разово, следующее → MiniMax)
chatMode=expertise           → Anthropic Sonnet (без изменений)
chatMode=create              → Anthropic Sonnet (без изменений)
Projects                     → Anthropic Haiku/Sonnet/Opus (без изменений)

Briefing Filter              → MiniMax M2.7 (минимониторинг)
Briefing Author              → MiniMax M2.7 (монолит, 26K+ tokens OK)
Podcast Script               → MiniMax M2.7 (диалоги Host/Expert)
Podcast TTS                  → Gemini Flash TTS (НЕ MiniMax — см. v3.82 revert)

MIND extract/consolidate     → MiniMax M2.7 (batch фактов)
```

**Ключевое:** MiniMax — основная модель для всех текстовых задач (Simply, Briefing, Podcast script, MIND). НЕ используется для vision и TTS — там Gemini.

---

## 3. Технические детали реализации

### Провайдер

```typescript
// route.ts
import { createMinimaxOpenAI } from "vercel-minimax-ai-provider";

const minimaxProvider = createMinimaxOpenAI();
function minimaxModel(modelId: string) {
  const model = minimaxProvider(modelId) as any;
  model.config = { ...model.config, includeUsage: true };
  return model;
}

// Вызов
modelToUse = minimaxModel("MiniMax-M2.7");
```

**Критически важно:** используется `minimaxOpenAI` (OpenAI-совместимый endpoint), НЕ `minimax` (Anthropic-совместимый). Причина: Anthropic endpoint не возвращает cache tokens — теряется видимость кэширования и завышается стоимость.

### Зависимость

```
vercel-minimax-ai-provider: ^0.0.2
```

Pre-release версия. При обновлении проверять:
- Появилась ли опция `includeUsage` в public API (сейчас патчим через `as any`)
- Не сломался ли маппинг usage полей

### ENV

```
MINIMAX_API_KEY=ключ_из_platform.minimax.io
```

Есть в `.env.local` и `.env.example`.

---

## 4. Кнопка «Думать»

Кнопка видна только при `chatMode === "simply"`. Логика:

- **Не нажата** → MiniMax M2.7 (быстро, дёшево)
- **Нажата** → Anthropic Sonnet (разово, одно сообщение)
- **Следующее сообщение** → снова MiniMax M2.7

Кнопка «Думать» = «получить более качественный ответ от более сильной модели». Не связана с thinking/reasoning режимом MiniMax.

---

## 5. Автоматическое кэширование

MiniMax кэширует автоматически без конфигурации. System prompt + MIND + история чата кэшируются на стороне MiniMax.

**Проверено в production:**

| Метрика | Значение |
|---------|----------|
| Cache hit rate | 97% |
| Стоимость с кэшем | ~$0.0011/сообщение |
| Стоимость без кэша | ~$0.0038/сообщение |
| Экономия | 3.5x на сообщение |

**Что видим в логах:**
- `cacheReadTokens` — приходят корректно (11K+ из 11.7K total)
- `cacheWriteTokens` — всегда 0 (MiniMax не возвращает, кэш создаётся неявно)
- `reasoningTokens` — всегда 0 (ограничение API MiniMax, reasoning включён в outputTokens)

---

## 6. Pricing

Файл: `lib/ai/providers.ts`, объект `MODEL_PRICING_RUB`

```typescript
"MiniMax-M2.7": {
  input: 0.03,        // $0.30/M → ₽0.03/1K
  output: 0.12,       // $1.20/M → ₽0.12/1K
  cached: 0.006,      // $0.06/M → ₽0.006/1K (cache read)
  cacheWrite: 0.0375  // $0.375/M → ₽0.0375/1K
}
```

Формула расчёта:

```
costRub = (freshInputTokens / 1000 × 0.03)
        + (cacheReadTokens  / 1000 × 0.006)
        + (outputTokens     / 1000 × 0.12)
```

Проверено: расчёт совпадает с реальным биллингом MiniMax.

---

## 7. Ограничения модели

| Что | Статус |
|-----|--------|
| Текст | ✅ Полная поддержка |
| Tool calling | ✅ Полная поддержка |
| Изображения на входе | ❌ Не поддерживает (→ Gemini 3 Flash) |
| Документы на входе (PDF/DOCX) | ❌ Не поддерживает |
| MCP servers | ❌ Игнорируется |
| stop_sequences | ❌ Игнорируется |
| top_k | ❌ Игнорируется |
| Temperature = 0 | ❌ Вызовет ошибку! Диапазон строго (0.0, 1.0] |
| generateObject (AI SDK) | ❌ Провайдер v0.0.2 не реализует responseFormat — возвращает Markdown |

**Temperature в Simply:** 0.7 для MiniMax, 1.0 для Anthropic.

---

## 8. Контекстное окно

- **Максимум:** 204,800 токенов
- **Стратегия:** Sliding Window (последние 20 сообщений, `SIMPLY_SLIDING_WINDOW_SIZE`)
- **Compaction:** отключён для MiniMax (флаг `isSimplyNonAnthropicModel`)
- **Snapshot:** используется стандартный механизм Simply (legacy, для Haiku)

---

## 9. DevPanel

- **Модель:** отображается как «MiniMax M2.7» (маппинг в `MODEL_DISPLAY`)
- **Токены:** inputTokens, outputTokens, cacheReadTokens — видны корректно
- **Reasoning:** показывается 0 (ограничение API), но reasoning стримится в UI как «Thinking...»
- **Стоимость:** считается с учётом кэша

---

## 10. Известный технический долг

| # | Что | Приоритет | Когда решать |
|---|-----|-----------|-------------|
| 1 | `includeUsage` через `as any` | Низкий | При обновлении провайдера выше 0.0.2 |
| 2 | `reasoningTokens` = 0 | Вне контроля | Ждём обновления MiniMax API |
| 3 | `cacheWriteTokens` = 0 | Вне контроля | Ждём обновления MiniMax API |
| 4 | Нет fallback на Haiku при падении MiniMax | Средний | Ближайшее ТЗ |
| 5 | Нет записи для M2.7-highspeed в pricing | Низкий | Если решим использовать highspeed |
| 6 | generateObject не работает (провайдер не реализует responseFormat) | Средний | При обновлении провайдера или raw fetch |

---

## 11. Файлы в проекте

| Файл | Что связано с MiniMax |
|------|----------------------|
| `lib/ai/registry.ts` | `minimax` + `minimaxLong` namespace (180s timeout для briefing) (v3.83+) |
| `lib/ai/model-catalog.ts` | `MiniMax-M2.7` и `MiniMax-M2.7-long` entries с pricing (v3.83+) |
| `lib/ai/task-assignments.ts` | `simply-chat`, `briefing:filter`, `briefing:author`, `briefing:section`, `briefing:podcast-script`, `memory:extract-batch`, `memory:consolidate`, `memory:profile` → MiniMax (v3.83+) |
| `lib/ai/providers.ts` | Pricing helpers только (после Stage 5 ТЗ-1) — модели живут в catalog |
| `app/(chat)/api/chat/route.ts` | Simply Chat — маршрутизация на MiniMax через `getModel("simply-chat")`, sliding window, temperature |
| `lib/briefing/briefing-filter.ts` | Briefing Filter — streamText + JSON.parse + Zod, retry, content truncation |
| `lib/briefing/briefing-author.ts` | Briefing Author — монолит (Map-Reduce dead code оставлен на будущее) |
| `lib/briefing/briefing-section-author.ts` | Per-section refresh + потенциал для Map-Reduce (`mode: "initial"`) |
| `lib/podcast/script-generator.ts` | Podcast script — generateText + universal parser (JSON или plain text) |
| `lib/ai/memory/extract.ts` | MIND batch extraction — streamText + JSON |
| `lib/ai/memory/consolidate.ts` | MIND consolidation |
| `lib/ai/memory/profile.ts` | MIND profile generation |
| `lib/ai/usage-utils.ts` | extractUsageFields() — универсальный для всех провайдеров |
| `components/dev-panel/sections/model-section.tsx` | MODEL_DISPLAY маппинг |
| `components/dev-panel/dev-panel-footer.tsx` | MODEL_DISPLAY маппинг |
| `components/input/input-think-button.tsx` | Кнопка «Думать» (видна только при chatMode=simply) |
| `.env.example` | MINIMAX_API_KEY |

---

## 12. Валидация биллинга

Для проверки корректности расчётов — сравнивать:

- **Наш расчёт:** сумма `costUsd` из `ai_usage_log` WHERE model = 'MiniMax-M2.7'
- **Реальное списание:** баланс на platform.minimax.io → Balance

При расхождении >10% — сообщить для корректировки ставок в `providers.ts`.

---

## 13. Краткая справка для ТЗ

При написании ТЗ, затрагивающих `chatMode=simply`:

- Модель: MiniMax M2.7 через OpenAI-совместимый endpoint
- Text-only: для изображений → Gemini 3 Flash (автоматическая маршрутизация)
- Кэш: автоматический, не требует конфигурации
- Temperature: 0.7 (не менять на 0!)
- Compaction: отключён для MiniMax
- Tools: поддерживаются полностью
- Thinking/Reasoning: модель сама решает когда думать, мы не управляем
