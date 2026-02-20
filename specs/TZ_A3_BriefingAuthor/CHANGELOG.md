# Changelog ТЗ-А3: Briefing Author

## Сессия 1 — 2026-02-20

### Added
- `lib/briefing/briefing-author.ts` — generateArticle(), Zod-схемы, tier mapping, fallback model
- `lib/prompts/briefing/briefing-author.md` — промпт автора (стиль Т—Ж, markdown, inline-ссылки)
- `lib/briefing/briefing-types.ts` — BriefingArticle, BriefingArticleSection, BriefingArticleSource, BriefingArticleMeta
- Old format guard в briefing-active-page.tsx (graceful fallback для старых записей)
- MarkdownViewer для рендера секций

### Changed
- `app/(chat)/api/briefing/generate/route.ts` — generateArticle вместо analyzeContent, user topics из БД, maxDuration 90
- `components/briefing/briefing-active-page.tsx` — markdown sections + source cards
- `components/briefing/briefing-card.tsx` — article.meta.totalNews
- `lib/briefing/briefing-config.ts` — AUTHOR_MODEL + AUTHOR_MODEL_FALLBACK, ROUTE_MAX_DURATION 90

### Removed
- `lib/briefing/briefing-analyzer.ts`
- `lib/prompts/briefing/briefing-analyst.md`
- Старые типы: BriefingJSON, BriefingBlock, BriefingItem

### Files
- lib/briefing/briefing-author.ts (новый)
- lib/briefing/briefing-types.ts (переписан)
- lib/briefing/briefing-config.ts (обновлён)
- lib/prompts/briefing/briefing-author.md (новый)
- app/(chat)/api/briefing/generate/route.ts (обновлён)
- components/briefing/briefing-active-page.tsx (переписан)
- components/briefing/briefing-card.tsx (обновлён)
- CHANGELOG.md, SIMPLY_STATUS.md, CLAUDE.md, package.json (v3.31.0)
- docs/ai-chats-map.md (обновлён)
