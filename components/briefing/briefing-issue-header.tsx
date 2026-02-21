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
 * ТЗ-А4 + ТЗ-BF3: Header for briefing issue page.
 * Desktop: «S Simply» brand (w-64, matches sidebar) | centered title | controls.
 * Mobile: ← Dashboard, mobile trigger, title, controls.
 */
export function BriefingIssueHeader({
  title,
  mobileTrigger,
}: BriefingIssueHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background">
      {/* ТЗ-BF3: Branded section — matches sidebar width, hidden on mobile */}
      <div className="hidden w-64 shrink-0 items-center gap-1 border-r px-3 md:flex">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold">
            S
          </div>
          <span className="text-lg font-semibold">Simply</span>
        </Link>
      </div>

      {/* Content header — title centered, controls right */}
      <div className="flex min-w-0 flex-1 items-center px-4">
        {/* Left: mobile nav */}
        <div className="flex shrink-0 items-center gap-1 md:hidden">
          <Link href="/dashboard">
            <Button size="icon" variant="ghost">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          {mobileTrigger}
        </div>

        {/* Center: title */}
        <h1 className="min-w-0 flex-1 truncate text-center font-serif text-lg font-semibold">
          {title}
        </h1>

        {/* Right: controls */}
        <div className="flex shrink-0 items-center gap-2">
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
      </div>
    </header>
  );
}
