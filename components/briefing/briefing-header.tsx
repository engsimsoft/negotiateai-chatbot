import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import type { BriefingJSON } from "@/lib/briefing/briefing-types";

interface BriefingHeaderProps {
  briefing: BriefingJSON | null;
}

export function BriefingHeader({ briefing }: BriefingHeaderProps) {
  const totalItems = briefing?.blocks?.reduce(
    (sum, block) => sum + block.items.length,
    0,
  ) ?? 0;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-serif text-lg font-semibold">
            ☀️ Утренний брифинг
          </h1>
          {briefing && (
            <p className="text-xs text-muted-foreground">
              {briefing.date} · {totalItems} {formatItemsWord(totalItems)}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" disabled title="Настройки (скоро)">
          <Settings className="size-4" />
        </Button>
        <UserMenu />
      </div>
    </header>
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
