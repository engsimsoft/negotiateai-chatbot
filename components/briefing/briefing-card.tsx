import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import type { BriefingHistory } from "@/lib/db/schema";
import type { BriefingArticle } from "@/lib/briefing/briefing-types";

interface BriefingCardProps {
  latestBriefing: BriefingHistory | null;
  /** ТЗ-BF2: Show unread Simply News indicator */
  hasSimplyUpdate?: boolean;
}

export function BriefingCard({ latestBriefing, hasSimplyUpdate }: BriefingCardProps) {
  // State: generating
  if (latestBriefing?.status === "generating") {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-background p-4">
        <span className="text-xl">☀️</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">Утренний брифинг</div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Генерируется...
          </div>
        </div>
      </div>
    );
  }

  // State: ready — show counters
  if (latestBriefing?.status === "ready") {
    const article = latestBriefing.briefingJson as BriefingArticle | null;
    const totalItems = article?.meta?.totalNews
      ?? article?.sections?.reduce((s: number, sec: { newsCount?: number }) => s + (sec.newsCount ?? 0), 0)
      ?? 0;

    return (
      <Link
        href="/briefing"
        className="group flex items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
      >
        <span className="text-xl">☀️</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">Утренний брифинг</div>
          <div className="text-xs text-muted-foreground">
            {hasSimplyUpdate ? (
              <span className="font-medium text-primary">1 новое</span>
            ) : (
              <>{totalItems} {formatItemsWord(totalItems)} · Читать</>
            )}
          </div>
        </div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
      </Link>
    );
  }

  // State: empty — no history
  return (
    <Link
      href="/briefing"
      className="group flex items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
    >
      <span className="text-xl">☀️</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">Утренний брифинг</div>
        <div className="text-xs text-muted-foreground">
          {hasSimplyUpdate ? (
            <span className="font-medium text-primary">1 новое</span>
          ) : (
            <>Дайджест новостей · Попробовать</>
          )}
        </div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </Link>
  );
}

function formatItemsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return "новостей";
  if (mod10 === 1) return "новость";
  if (mod10 >= 2 && mod10 <= 4) return "новости";
  return "новостей";
}
