"use client";

/**
 * RightSidebar — унифицированный правый сайдбар
 *
 * Визуальный паритет с AppSidebar (левый):
 * - bg-sidebar / text-sidebar-foreground (те же CSS-переменные)
 * - border-l border-sidebar-border, без shadow
 * - duration-200 ease-linear (как левый)
 * - inset-y-0 (полная высота, как левый)
 *
 * Mobile: Sheet overlay (как левый на мобильных)
 * Desktop: fixed push-panel (родитель добавляет md:mr-[380px])
 *
 * Переиспользуется: Chat, Projects, Helpers
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** Ширина правого сайдбара (для push-layout: md:mr-[380px]) */
export const RIGHT_SIDEBAR_WIDTH = "380px";

interface RightSidebarProps {
  /** Открыт ли сайдбар */
  open: boolean;
  /** Callback закрытия */
  onClose: () => void;
  /** Заголовок в header */
  title: string;
  /** Основной контент (scrollable) */
  children: ReactNode;
  /** Footer (опционально, прибит к низу) */
  footer?: ReactNode;
}

export function RightSidebar({
  open,
  onClose,
  title,
  children,
  footer,
}: RightSidebarProps) {
  const isMobile = useIsMobile();

  const header = (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-4">
      <span className="text-sm font-medium">{title}</span>
      <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
        <X className="size-4" />
        <span className="sr-only">Закрыть</span>
      </Button>
    </div>
  );

  const content = (
    <div className="flex-1 overflow-y-auto">{children}</div>
  );

  const footerEl = footer ? (
    <div className="shrink-0 border-t border-sidebar-border p-2">{footer}</div>
  ) : null;

  // Mobile: Sheet overlay (как левый сайдбар)
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <SheetContent
          side="right"
          className="w-[85vw] max-w-[380px] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>Боковая панель: {title}</SheetDescription>
          </SheetHeader>
          <div className="flex h-full flex-col">
            {header}
            {content}
            {footerEl}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: fixed push-panel
  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-10 hidden w-[380px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground md:flex",
        "transition-transform duration-200 ease-linear",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {header}
      {content}
      {footerEl}
    </div>
  );
}
