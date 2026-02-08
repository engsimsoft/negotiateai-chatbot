"use client";

import { useState, type ReactNode } from "react";
import { LayoutList, User } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ManagerDrawer } from "./manager-drawer";

interface ProjectPageLayoutProps {
  projectId: string;
  headerLeft: ReactNode;
  pulse: ReactNode;
  workArea: ReactNode;
}

/**
 * ТЗ-A1: Двухколоночный layout страницы проекта
 *
 * - Левая колонка: Пульс (~300px, sticky, независимый скролл)
 * - Правая колонка: Рабочая область (flex-1)
 * - Полноэкранный (без max-w)
 * - Push-drawer Менеджера (сжимает рабочую область на desktop)
 * - Mobile: Пульс в bottom sheet, Drawer в bottom sheet
 */
export function ProjectPageLayout({
  projectId,
  headerLeft,
  pulse,
  workArea,
}: ProjectPageLayoutProps) {
  const [pulseSheetOpen, setPulseSheetOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-8">
        {headerLeft}
        <Button
          variant={drawerOpen ? "default" : "outline"}
          size="sm"
          className="gap-1.5"
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          <User className="size-4" />
          <span className="hidden sm:inline">Менеджер</span>
        </Button>
      </header>

      {/* Mobile Pulse trigger — fixed bottom-right */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-4 right-4 z-40 size-12 rounded-full shadow-lg lg:hidden bg-background"
        onClick={() => setPulseSheetOpen(true)}
      >
        <LayoutList className="size-5" />
      </Button>

      {/* Mobile Pulse Sheet (bottom) */}
      <Sheet open={pulseSheetOpen} onOpenChange={setPulseSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle>Пульс проекта</SheetTitle>
          </SheetHeader>
          {pulse}
        </SheetContent>
      </Sheet>

      {/* Content: Pulse + WorkArea + optional Drawer */}
      <div className="flex flex-1 min-h-0">
        {/* Pulse — left panel (hidden on mobile, independent scroll) */}
        <aside className="hidden lg:flex w-[300px] shrink-0 flex-col border-r bg-background overflow-y-auto overscroll-contain">
          {pulse}
        </aside>

        {/* WorkArea — main content (independent scroll, push-margin on desktop when drawer open) */}
        <main
          className={cn(
            "flex-1 min-w-0 overflow-y-auto overscroll-contain transition-[margin] duration-300 ease-in-out",
            drawerOpen && "lg:mr-[400px]"
          )}
        >
          {workArea}
        </main>

        {/* Manager Drawer */}
        <ManagerDrawer open={drawerOpen} onOpenChange={setDrawerOpen} projectId={projectId} />
      </div>
    </div>
  );
}
