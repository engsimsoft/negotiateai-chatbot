"use client";

import { useState, useEffect, useRef } from "react";
import { Bookmark, ChevronDown, ArrowRight, ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { BriefingSourceCard } from "./briefing-source-card";
import type {
  BriefingArticle,
  BriefingArticleSection,
  SavedBriefingTopicClient,
} from "@/lib/briefing/briefing-types";

interface BriefingArticleViewProps {
  article: BriefingArticle;
  /** Scroll spy callback — fires with active section topicId */
  onActiveSectionChange?: (id: string | null) => void;
  /** ТЗ-BF1: Saved topics for bookmark state */
  savedTopics?: SavedBriefingTopicClient[];
  /** ТЗ-BF1: Save a topic */
  onSaveTopic?: (section: BriefingArticleSection) => void;
  /** ТЗ-BF1: Delete a saved topic by its saved ID */
  onDeleteTopic?: (savedId: string) => void;
}

/**
 * ТЗ-А4: Full article reader — intro, sections (markdown + collapsible sources), outro, meta.
 * Each section has id={topicId} for scroll-to from sidebar.
 * IntersectionObserver scroll spy updates activeSectionId in parent.
 * ТЗ-BF1: Bookmark buttons on each section.
 */
export function BriefingArticleView({
  article,
  onActiveSectionChange,
  savedTopics = [],
  onSaveTopic,
  onDeleteTopic,
}: BriefingArticleViewProps) {
  const callbackRef = useRef(onActiveSectionChange);
  callbackRef.current = onActiveSectionChange;

  useEffect(() => {
    if (!callbackRef.current) return;

    const topicIds = article.sections.map((s) => s.topicId);
    const sectionEls = topicIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (sectionEls.length === 0) return;

    const visibleIds = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        }
        // Pick first visible section in document order
        const active = topicIds.find((id) => visibleIds.has(id)) ?? null;
        callbackRef.current?.(active);
      },
      {
        // Header 56px + player ~60px = 116px from top; bottom 40% ignored
        rootMargin: "-116px 0px -40% 0px",
      }
    );

    sectionEls.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [article.sections]);

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-6">
      {/* Meta */}
      {article.meta && (
        <p className="mb-4 text-sm text-muted-foreground">
          {article.meta.totalNews} новостей · {article.meta.topicsCount} тем ·{" "}
          {article.meta.readingTimeMinutes} мин чтения
        </p>
      )}

      {/* Intro */}
      {article.intro && (
        <div className="mb-8 rounded-xl border bg-background p-5">
          <p className="text-foreground leading-relaxed">{article.intro}</p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-6">
        {article.sections.map((section) => {
          const saved = savedTopics.find((t) => t.topicId === section.topicId);
          return (
            <ArticleSection
              key={section.topicId}
              section={section}
              isSaved={!!saved}
              onToggleBookmark={() => {
                if (saved) {
                  onDeleteTopic?.(saved.id);
                } else {
                  onSaveTopic?.(section);
                }
              }}
            />
          );
        })}
      </div>

      {/* Outro */}
      {article.outro && (
        <div className="mt-8 text-center">
          <p className="text-muted-foreground italic">{article.outro}</p>
        </div>
      )}
    </article>
  );
}

/* --- Article section with markdown content + collapsible sources --- */

function ArticleSection({
  section,
  isSaved,
  onToggleBookmark,
}: {
  section: BriefingArticleSection;
  isSaved: boolean;
  onToggleBookmark: () => void;
}) {
  return (
    <section id={section.topicId} className="scroll-mt-32 rounded-xl border bg-background p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span>{section.emoji}</span>
        <span className="flex-1">{section.topicName}</span>
        <button
          type="button"
          onClick={onToggleBookmark}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-primary"
          title={isSaved ? "Удалить из сохранённых" : "Сохранить тему"}
        >
          <Bookmark
            className={`size-5 ${isSaved ? "fill-primary text-primary" : ""}`}
          />
        </button>
      </h2>

      {/* Markdown content */}
      <MarkdownViewer content={section.content} className="text-sm" />

      {/* Collapsible sources */}
      {section.sources?.length > 0 && (
        <CollapsibleSources sources={section.sources} />
      )}
    </section>
  );
}

/* --- Collapsible sources block --- */

function CollapsibleSources({
  sources,
}: {
  sources: BriefingArticleSection["sources"];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-4 border-t pt-3">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
        <span>📰 Источники ({sources.length})</span>
        <ChevronDown
          className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1">
        {sources.map((source, idx) => (
          <BriefingSourceCard key={`${source.url}-${idx}`} source={source} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* --- Empty state: no briefings yet --- */

interface NoBriefingsYetProps {
  className?: string;
  onGenerate?: () => void;
}

export function NoBriefingsYet({ className, onGenerate }: NoBriefingsYetProps) {
  return (
    <div className={`py-16 text-center ${className ?? ""}`}>
      <span className="mb-4 inline-block text-5xl">{"\u{2600}\u{FE0F}"}</span>
      <h2 className="mb-3 font-serif text-xl font-semibold">
        Выпусков пока нет
      </h2>
      <p className="mx-auto mb-6 max-w-sm text-muted-foreground">
        Ваш профиль настроен. Сгенерируйте первый брифинг или дождитесь
        утреннего выпуска.
      </p>
      <Button className="gap-2" onClick={onGenerate}>
        Сгенерировать сейчас
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

/* --- ТЗ-BF1: Saved topic view (replaces main area) --- */

interface SavedTopicViewProps {
  topic: SavedBriefingTopicClient;
  onBack: () => void;
  onDelete: (savedId: string) => void;
}

export function SavedTopicView({ topic, onBack, onDelete }: SavedTopicViewProps) {
  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-6">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        <span>Назад к выпуску</span>
      </button>

      {/* Topic card */}
      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <span>{topic.emoji}</span>
          <span className="flex-1">{topic.topicName}</span>
        </h2>

        {/* Markdown content */}
        <MarkdownViewer content={topic.content} className="text-sm" />

        {/* Sources */}
        {topic.sources?.length > 0 && (
          <CollapsibleSources sources={topic.sources} />
        )}

        {/* Delete button */}
        <div className="mt-6 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(topic.id)}
          >
            <Trash2 className="size-4" />
            Удалить из сохранённых
          </Button>
        </div>
      </section>
    </article>
  );
}
