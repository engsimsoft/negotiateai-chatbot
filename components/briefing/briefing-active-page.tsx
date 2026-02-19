"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Settings, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BriefingHeader } from "./briefing-header";
import type { BriefingHistory } from "@/lib/db/schema";
import type { BriefingJSON, BriefingBlock } from "@/lib/briefing/briefing-types";

interface BriefingActivePageProps {
  briefing: BriefingHistory | null;
}

/**
 * ТЗ-A2: Active briefing page — shows latest issue or "no issues yet" state.
 * Displayed when user has an active briefing profile (isActive=true).
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

/* --- Latest briefing issue --- */

function BriefingIssue({ briefing }: { briefing: BriefingHistory }) {
  const data = briefing.briefingJson as unknown as BriefingJSON;
  const date = new Date(briefing.generatedAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="mb-6 text-center">
        <span className="mb-2 inline-block text-4xl">☀️</span>
        <h2 className="font-serif text-xl font-semibold">Выпуск за {date}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.blocks.reduce((sum, b) => sum + b.items.length, 0)} новостей из{" "}
          {data.totalSourcesChecked} источников
        </p>
      </div>

      <div className="space-y-4">
        {data.blocks.map((block) => (
          <IssueBlock key={block.topicId} block={block} />
        ))}
      </div>
    </>
  );
}

function IssueBlock({ block }: { block: BriefingBlock }) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">
        <span>{block.emoji}</span>
        <span>{block.topicName}</span>
        <span className="text-xs font-normal text-muted-foreground">
          ({block.items.length})
        </span>
      </h3>
      <div className="space-y-3">
        {block.items.map((item) => (
          <div key={item.sourceUrl}>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              {item.title}
            </a>
            <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {item.sourceName}
            </p>
          </div>
        ))}
      </div>
    </div>
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
