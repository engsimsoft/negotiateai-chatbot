"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ArrowRight, Loader2 } from "lucide-react";
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
} from "@/lib/briefing/briefing-types";

interface BriefingArticleViewProps {
  article: BriefingArticle;
  /** Scroll spy callback — fires with active section topicId */
  onActiveSectionChange?: (id: string | null) => void;
}

/**
 * ТЗ-А4: Full article reader — intro, sections (markdown + collapsible sources), outro, meta.
 * Each section has id={topicId} for scroll-to from sidebar.
 * IntersectionObserver scroll spy updates activeSectionId in parent.
 */
export function BriefingArticleView({
  article,
  onActiveSectionChange,
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
        {article.sections.map((section) => (
          <ArticleSection key={section.topicId} section={section} />
        ))}
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

function ArticleSection({ section }: { section: BriefingArticleSection }) {
  return (
    <section id={section.topicId} className="scroll-mt-32 rounded-xl border bg-background p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <span>{section.emoji}</span>
        <span>{section.topicName}</span>
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
        {sources.map((source) => (
          <BriefingSourceCard key={source.url} source={source} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* --- Empty state: no briefings yet --- */

interface NoBriefingsYetProps {
  className?: string;
}

export function NoBriefingsYet({ className }: NoBriefingsYetProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      if (!res.ok) throw new Error("Failed to generate");
      router.refresh();
    } catch {
      setIsGenerating(false);
    }
  }, [isGenerating, router]);

  return (
    <div className={`py-16 text-center ${className ?? ""}`}>
      <span className="mb-4 inline-block text-5xl">☀️</span>
      <h2 className="mb-3 font-serif text-xl font-semibold">
        Выпусков пока нет
      </h2>
      <p className="mx-auto mb-6 max-w-sm text-muted-foreground">
        Ваш профиль настроен. Сгенерируйте первый брифинг или дождитесь
        утреннего выпуска.
      </p>
      <Button className="gap-2" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Генерация...
          </>
        ) : (
          <>
            Сгенерировать сейчас
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </div>
  );
}
