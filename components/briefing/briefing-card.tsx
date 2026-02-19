import Link from "next/link";
import { ArrowRight, Loader2, Sun } from "lucide-react";
import type { BriefingHistory } from "@/lib/db/schema";
import type { BriefingJSON } from "@/lib/briefing/briefing-types";

interface BriefingCardProps {
  latestBriefing: BriefingHistory | null;
}

export function BriefingCard({ latestBriefing }: BriefingCardProps) {
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
    const briefingJson = latestBriefing.briefingJson as BriefingJSON;
    const totalItems = briefingJson.blocks?.reduce(
      (sum, block) => sum + block.items.length,
      0,
    ) ?? 0;

    return (
      <Link
        href="/briefing"
        className="group flex items-center gap-3 rounded-xl border bg-background p-4 transition-all hover:border-primary hover:shadow-sm"
      >
        <span className="text-xl">☀️</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">Утренний брифинг</div>
          <div className="text-xs text-muted-foreground">
            {totalItems} {formatItemsWord(totalItems)} · Читать
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
          Дайджест новостей · Попробовать
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
