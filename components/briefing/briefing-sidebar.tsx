"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  Settings,
  RefreshCw,
  Menu,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { BriefingArticleSection } from "@/lib/briefing/briefing-types";

/* --- Types --- */

export interface BriefingHistoryItem {
  date: string; // YYYY-MM-DD
  label: string; // "20 февраля"
}

interface BriefingSidebarProps {
  /** Sections from current article (for topic navigation) */
  sections: BriefingArticleSection[];
  /** Past issues for history list */
  history: BriefingHistoryItem[];
  /** Currently viewed date (YYYY-MM-DD) for highlight */
  currentDate?: string;
  /** Active section id from scroll spy (Этап 3) */
  activeSectionId?: string | null;
  /** ТЗ-А5: Callback to trigger generation (handled by parent) */
  onGenerate?: () => void;
}

/**
 * ТЗ-А4: Briefing sidebar — topic navigation, history, settings, generate.
 * Desktop: static left column. Mobile: Sheet via BriefingSidebarTrigger.
 */
export function BriefingSidebar({
  sections,
  history,
  currentDate,
  activeSectionId,
  onGenerate,
}: BriefingSidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <SidebarContent
        sections={sections}
        history={history}
        currentDate={currentDate}
        activeSectionId={activeSectionId}
        onGenerate={onGenerate}
      />
    </div>
  );
}

/**
 * Mobile trigger button — renders in header, opens Sheet with sidebar.
 */
export function BriefingSidebarMobile({
  sections,
  history,
  currentDate,
  activeSectionId,
  onGenerate,
}: BriefingSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="md:hidden"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
        <span className="sr-only">Навигация</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[280px] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Навигация по брифингу</SheetTitle>
            <SheetDescription>Темы и история выпусков</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            <SidebarContent
              sections={sections}
              history={history}
              currentDate={currentDate}
              activeSectionId={activeSectionId}
              onNavigate={() => setOpen(false)}
              onGenerate={onGenerate}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* --- Shared sidebar content --- */

function SidebarContent({
  sections,
  history,
  currentDate,
  activeSectionId,
  onNavigate,
  onGenerate,
}: BriefingSidebarProps & { onNavigate?: () => void }) {
  const handleScrollTo = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
        onNavigate?.();
      }
    },
    [onNavigate]
  );

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    onNavigate?.();
  }, [onNavigate]);

  return (
    <>
      {/* Topic navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Сегодня
        </p>

        <button
          type="button"
          onClick={handleScrollToTop}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
        >
          <BookOpen className="size-4 text-muted-foreground" />
          <span>Полный брифинг</span>
        </button>

        {sections.map((section) => (
          <button
            key={section.topicId}
            type="button"
            onClick={() => handleScrollTo(section.topicId)}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
              activeSectionId === section.topicId &&
                "bg-primary/10 font-medium text-primary"
            )}
          >
            <span>{section.emoji}</span>
            <span className="truncate">{section.topicName}</span>
          </button>
        ))}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Прошлые выпуски
            </p>
            {history.map((item) => (
              <Link
                key={item.date}
                href={`/briefing/${item.date}`}
                onClick={onNavigate}
                className={cn(
                  "mb-0.5 flex w-full items-center rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                  currentDate === item.date &&
                    "bg-primary/10 font-medium text-primary"
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer: Generate + Settings */}
      <div className="shrink-0 border-t px-3 py-3 space-y-1">
        <button
          type="button"
          onClick={onGenerate}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
        >
          <RefreshCw className="size-4 text-muted-foreground" />
          <span>Сгенерировать</span>
        </button>

        <Link
          href="/briefing/setup"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/60"
        >
          <Settings className="size-4 text-muted-foreground" />
          <span>Настройки</span>
        </Link>
      </div>
    </>
  );
}

