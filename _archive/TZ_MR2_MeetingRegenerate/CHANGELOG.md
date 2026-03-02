# Changelog ТЗ-MR2: Стенограмма — Регенерация + Инструкции + PDF

## Сессия 1 — 2026-03-02

### Added
- SPEC.md — ТЗ скопировано
- ANALYSIS.md — анализ с код-ревью и рекомендациями
- ROADMAP.md — план на 4 этапа

### Decisions
- pdfmake вместо puppeteer (Vercel serverless)
- Извлечение summarizeTranscript() в reusable функцию
- ON DELETE SET NULL для originalRecordId FK
- Лимит 2000 символов на userInstructions
- Source Sans 3 для PDF (fallback Noto Sans)
- originalRecordId всегда ссылается на root (плоская структура)
