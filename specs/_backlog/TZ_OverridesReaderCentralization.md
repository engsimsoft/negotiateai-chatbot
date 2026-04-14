# ТЗ-OverridesReaderCentralization

**Источник:** `specs/TZ_DeadModelSelectors/FINDINGS.md` Finding #2 (внесено 2026-04-14)
**Impact:** high (архитектурный, корректность override в production)
**Оценка:** 1 сессия (с careful testing)

## Проблема

Reader `.simply-dev-overrides.json` регистрируется только при импорте `@/lib/ai/model-overrides-node`. В настоящее время side-effect import стоит всего в 4 местах:
- `app/(chat)/api/chat/route.ts`
- `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` (добавлен в коммите `9ddf814` сессии 2026-04-14)
- `app/(dashboard)/dev/models/page.tsx`
- `app/(dashboard)/dev/models/actions.ts`

**Все остальные ~20 call-sites `getModel()` не импортируют model-overrides-node:**
- `app/(chat)/api/service-chat/route.ts`
- `app/(chat)/api/assistant/ben/route.ts`
- `app/(chat)/api/chat/[id]/generate-title/route.ts`
- `app/(chat)/api/projects/[id]/plan/route.ts`
- `app/(chat)/api/projects/[id]/generate-summary/route.ts`
- `app/(chat)/api/projects/[id]/analyze-file/route.ts`
- `app/(chat)/actions.ts` (server actions: `generateTitleFromUserMessage`)
- `lib/briefing/*` (briefing author, section author, filter)
- `lib/podcast/*` (script generator)
- `lib/meeting/*` (meeting pipeline)
- `lib/ai/clerks/*` (task-summarizer)
- `lib/ai/memory/*` (extract, consolidate, profile)
- `lib/ai/professors/*` (task-reviewer)
- `lib/ai/professor-pipeline.ts`
- `lib/ai/tools/request-suggestions.ts`
- `lib/ai/vision-ocr.ts`
- `artifacts/*` серверы (text, markdown, excel, presentation-reveal, presentation-pptx)

## Почему это проблема

В Next.js production (Vercel serverless) каждый route handler — изолированный module graph. Side-effect import работает только для того графа, куда его явно положили. В dev single-process работает «как будто всё общее», но это артефакт HMR cache.

Результат: override из `/dev/models` применяется только к 4 перечисленным выше точкам. Во всех остальных — **молчаливо игнорируется в production**.

## Два варианта решения

### Вариант 1 (канонический Next.js): `instrumentation.ts`

```ts
import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "ai-chatbot" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/ai/model-overrides-node");
  }
}
```

**Плюсы:** один раз при старте сервера, гарантированно до любого роута, закрывает все call-sites одним изменением.

**Минусы:** требует careful testing. Правка `instrumentation.ts` не подхватывается HMR корректно — нужен cold restart.

**ИСТОРИЧЕСКИЙ НЮАНС:** В сессии 2026-04-14 этот подход был применён, затем откачен после того как HMR recompile посреди streaming сломал активный tool call. Рекомендация: применять ТОЛЬКО на холодном сервере (убить `next dev` → edit instrumentation.ts → restart), НЕ при активном streaming.

### Вариант 2 (механическое копирование импорта)

Прописать `import "@/lib/ai/model-overrides-node";` в каждом из ~20 файлов-импортёров `getModel`.

**Плюсы:** локально видно в каждом файле, не требует HMR-внимания.

**Минусы:** антипаттерн, легко забыть в новом роуте. Технический долг консервируется.

## Рекомендация

**Вариант 1** — это правильный архитектурный фикс. Провести на холодном сервере, с пустым browser tab (нет активных стримов), с ручным тестированием override в 3-4 ключевых путях (simply, projects, briefing, meeting).

## Definition of Done

- [ ] `instrumentation.ts` обновлён с conditional dynamic import
- [ ] Из `app/(chat)/api/chat/route.ts` и `app/(chat)/api/projects/[id]/tasks/[taskId]/chat/route.ts` удалён теперь избыточный side-effect import (они получают reader через instrumentation)
- [ ] `tsc --noEmit` = 0
- [ ] `next build` успешен
- [ ] Мануальный тест override в проектах, simply, expertise, create
- [ ] (желательно) Тест что override применяется в backend-only call-sites — например Clerk task-summarizer через запуск task expert chat
- [ ] Эта ТЗ-заготовка удаляется, закрытое ТЗ архивируется
