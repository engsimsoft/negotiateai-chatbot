"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { DebugErrorData } from "@/lib/ai/debug-events";
import { ErrorsList } from "./sections/errors-section";

/**
 * ТЗ-DevPanelErrors: Drawer for global session errors — errors not tied to
 * any specific assistant message. Sources: window.onerror, unhandledrejection,
 * React Error Boundary render crashes, useChat.onError fired before any
 * message exists.
 *
 * Opened from the chat header indicator (see SessionErrorsIndicator).
 */

export function SessionErrorsDrawer({
  open,
  onOpenChange,
  errors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  errors: DebugErrorData[];
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-110">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">
            Session Errors
            {errors.length > 0 && (
              <span className="ml-2 text-muted-foreground">
                ({errors.length})
              </span>
            )}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Client errors captured in the current session that are not tied to
            a specific message.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-4">
          <ErrorsList errors={errors} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
