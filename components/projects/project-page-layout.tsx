"use client";

import type { ReactNode } from "react";

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
 */
export function ProjectPageLayout({
  pulse,
  workArea,
  managerDrawer,
  header,
  isDrawerOpen = false,
}: ProjectPageLayoutProps) {
  return (
    <div className="flex h-svh flex-col overflow-hidden bg-muted/30">
      {/* Header */}
      {header}

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
