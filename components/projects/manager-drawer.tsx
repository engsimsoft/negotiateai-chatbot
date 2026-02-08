"use client";

/**
 * ТЗ-A1, Этап 5: ManagerDrawer
 *
 * Push-drawer Менеджера проекта (каркас без AI).
 * - Desktop (lg+): фиксированная панель справа (400px), WorkArea сжимается
 * - Mobile: bottom sheet через vaul
 */

import { User, X } from "lucide-react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

interface ManagerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DesktopManagerDrawer({ open, onOpenChange }: ManagerDrawerProps) {
  return (
    <div
      className={cn(
        "fixed right-0 top-[3.5rem] bottom-0 z-30 w-[400px] flex flex-col border-l bg-background shadow-xl",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
            <User className="size-4 text-primary" />
          </div>
          <span className="font-semibold">Менеджер проекта</span>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="rounded-full p-2 hover:bg-muted transition-colors"
        >
          <X className="size-4" />
          <span className="sr-only">Закрыть</span>
        </button>
      </div>

      {/* Messages — stub */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-muted-foreground">
          <div className="mb-3 text-4xl">🤖</div>
          <p className="font-medium">Менеджер проекта</p>
          <p className="mt-1 text-sm">
            Скоро здесь появится ваш AI-помощник для управления проектом
          </p>
        </div>
      </div>

      {/* Actions zone — reserved */}
      <div className="h-16 border-t bg-muted/30" />

      {/* Input — disabled */}
      <div className="border-t p-3">
        <div className="flex items-center rounded-lg border bg-muted/50 px-3 py-2.5 opacity-60 cursor-not-allowed">
          <span className="text-sm text-muted-foreground">
            Скоро здесь можно будет общаться с Менеджером
          </span>
        </div>
      </div>
    </div>
  );
}

function MobileManagerDrawer({ open, onOpenChange }: ManagerDrawerProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl border-t bg-background">
          {/* Handle */}
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/20" />

          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
                <User className="size-4 text-primary" />
              </div>
              <Drawer.Title className="font-semibold">
                Менеджер проекта
              </Drawer.Title>
            </div>
            <Drawer.Close asChild>
              <button className="rounded-full p-2 hover:bg-muted transition-colors">
                <X className="size-4" />
                <span className="sr-only">Закрыть</span>
              </button>
            </Drawer.Close>
          </div>

          {/* Messages — stub */}
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center text-muted-foreground">
              <div className="mb-3 text-4xl">🤖</div>
              <p className="font-medium">Менеджер проекта</p>
              <p className="mt-1 text-sm">
                Скоро здесь появится ваш AI-помощник для управления проектом
              </p>
            </div>
          </div>

          {/* Actions zone — reserved */}
          <div className="h-16 border-t bg-muted/30" />

          {/* Input — disabled */}
          <div className="border-t p-3">
            <div className="flex items-center rounded-lg border bg-muted/50 px-3 py-2.5 opacity-60 cursor-not-allowed">
              <span className="text-sm text-muted-foreground">
                Скоро здесь можно будет общаться с Менеджером
              </span>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function ManagerDrawer(props: ManagerDrawerProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  if (isDesktop === null) return null;

  return isDesktop ? (
    <DesktopManagerDrawer {...props} />
  ) : (
    <MobileManagerDrawer {...props} />
  );
}
