import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Headphones, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

interface BriefingIssueHeaderProps {
  title: string;
  /** Optional slot for mobile sidebar trigger (rendered before title) */
  mobileTrigger?: ReactNode;
}

/**
 * ТЗ-А4: Header for briefing issue page.
 * Shows ← Dashboard, [mobile trigger], article title, ⚙️ settings, UserMenu.
 * Separate from BriefingHeader (used by landing page).
 */
export function BriefingIssueHeader({
  title,
  mobileTrigger,
}: BriefingIssueHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        {mobileTrigger}
        <h1 className="truncate font-serif text-lg font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" className="gap-1.5 rounded-lg" disabled>
          <Headphones className="size-4" />
          <span className="hidden sm:inline">Скоро: подкаст</span>
        </Button>
        <Link href="/briefing/setup">
          <Button size="icon" variant="ghost">
            <Settings className="size-4" />
          </Button>
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
