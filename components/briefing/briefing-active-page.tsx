"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Settings, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { BriefingHeader } from "./briefing-header";
import type { BriefingHistory } from "@/lib/db/schema";
import type {
  BriefingArticle,
  BriefingArticleSection,
  BriefingArticleSource,
} from "@/lib/briefing/briefing-types";

interface BriefingActivePageProps {
  briefing: BriefingHistory | null;
}

/**
 * ТЗ-А3: Active briefing page — shows latest article or "no issues yet" state.
 * Temporary UI until ТЗ-А4 (full article reader).
 */
export function BriefingActivePage({ briefing }: BriefingActivePageProps) {
  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <BriefingHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 lg:px-6">
        {briefing ? (
          <BriefingIssue briefing={briefing} />
        ) : (
          <NoBriefingsYet />
        )}

        {/* Settings link */}
        <div className="mt-8 text-center">
          <Link href="/briefing/setup">
            <Button variant="outline" className="gap-2">
              <Settings className="size-4" />
              Настройки брифинга
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

/* --- Latest briefing issue (article format) --- */

function BriefingIssue({ briefing }: { briefing: BriefingHistory }) {
  const article = briefing.briefingJson as unknown as BriefingArticle;

  // Guard: old format or malformed data
  if (!article?.sections) {
    return (
      <div className="py-16 text-center">
        <span className="mb-4 inline-block text-5xl">☀️</span>
        <h2 className="mb-3 font-serif text-xl font-semibold">
          Выпуск доступен в старом формате
        </h2>
        <p className="text-muted-foreground">
          Сгенерируйте новый брифинг для просмотра в формате статьи.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Title + meta */}
      <div className="mb-6 text-center">
        <span className="mb-2 inline-block text-4xl">☀️</span>
        <h2 className="font-serif text-xl font-semibold">{article.title}</h2>
        {article.meta && (
          <p className="mt-1 text-sm text-muted-foreground">
            {article.meta.totalNews} новостей · {article.meta.topicsCount} тем
            · {article.meta.readingTimeMinutes} мин чтения
          </p>
        )}
      </div>

      {/* Intro */}
      {article.intro && (
        <div className="mb-6 rounded-xl border bg-background p-5">
          <p className="text-foreground leading-relaxed">{article.intro}</p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {article.sections.map((section) => (
          <ArticleSection key={section.topicId} section={section} />
        ))}
      </div>

      {/* Outro */}
      {article.outro && (
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground italic">
            {article.outro}
          </p>
        </div>
      )}
    </>
  );
}

/* --- Article section with content + sources --- */

function ArticleSection({ section }: { section: BriefingArticleSection }) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <span>{section.emoji}</span>
        <span>{section.topicName}</span>
        <span className="text-xs font-normal text-muted-foreground">
          ({section.newsCount})
        </span>
      </h3>

      {/* Markdown content */}
      <MarkdownViewer content={section.content} className="text-sm" />

      {/* Sources */}
      {section.sources?.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Источники
          </p>
          <div className="space-y-2">
            {section.sources.map((source) => (
              <SourceCard key={source.url} source={source} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Source card --- */

function SourceCard({ source }: { source: BriefingArticleSource }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2 rounded-lg p-2 transition-colors hover:bg-muted/60"
    >
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground group-hover:underline">
          {source.title}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{source.summary}</p>
        <p className="mt-0.5 text-xs text-muted-foreground/70">
          {source.sourceName}
          {source.tier && source.tier !== "unknown" && (
            <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px]">
              {source.tier}
            </span>
          )}
        </p>
      </div>
    </a>
  );
}

/* --- No briefings yet state --- */

function NoBriefingsYet() {
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
    <div className="py-16 text-center">
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
