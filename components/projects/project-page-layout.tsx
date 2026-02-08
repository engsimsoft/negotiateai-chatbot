"use client";

import { useState, type ReactNode } from "react";
import { LayoutList } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface ProjectPageLayoutProps {
  pulse: ReactNode;
  workArea: ReactNode;
  managerDrawer?: ReactNode;
  header: ReactNode;
  isDrawerOpen?: boolean;
}

/**
 * ТЗ-A1: Двухколоночный layout страницы проекта
 *
 * - Левая колонка: Пульс (~300px, sticky, независимый скролл)
 * - Правая колонка: Рабочая область (flex-1)
 * - Полноэкранный (без max-w)
 * - Поддержка push-drawer Менеджера (сжимает рабочую область)
 * - Mobile: Пульс в bottom sheet
 */
export function ProjectPageLayout({
  pulse,
  workArea,
  managerDrawer,
  header,
  isDrawerOpen = false,
}: ProjectPageLayoutProps) {
  const [pulseSheetOpen, setPulseSheetOpen] = useState(false);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-muted/30">
      {/* Header */}
      {header}

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

        {/* WorkArea — main content (independent scroll) */}
        <main
          className="flex-1 min-w-0 overflow-y-auto overscroll-contain transition-all duration-300"
          style={{
            marginRight: isDrawerOpen ? 400 : 0,
          }}
        >
          {workArea}
        </main>

        {/* Manager Drawer (renders when provided) */}
        {managerDrawer}
      </div>
    </div>
  );
}
