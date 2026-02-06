"use client";

import { useCallback, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FileViewerHeader } from "./file-viewer-header";
import { FileViewerContent } from "./file-viewer-content";
import type { FileViewerProps } from "./types";

/**
 * FileViewer — модалка для просмотра файлов проекта
 *
 * Особенности:
 * - Radix Dialog (focus trap, ESC, click outside — бесплатно)
 * - Навигация стрелками ← → между файлами
 * - ARIA: role="dialog", aria-modal="true", aria-label
 * - Три состояния: Loading, Success, Error/Unsupported
 *
 * В Этапе 1 всегда показывает UnsupportedRenderer.
 * В Этапе 2+ будет switch по типу файла.
 */
export function FileViewer({
  file,
  files,
  currentIndex = 0,
  open,
  onClose,
  onNavigate,
}: FileViewerProps) {
  const hasNavigation = files && files.length > 1 && onNavigate;
  const canGoPrev = hasNavigation && currentIndex > 0;
  const canGoNext = hasNavigation && currentIndex < files.length - 1;

  // Navigate to previous file
  const goToPrev = useCallback(() => {
    if (canGoPrev && onNavigate) {
      onNavigate(currentIndex - 1);
    }
  }, [canGoPrev, currentIndex, onNavigate]);

  // Navigate to next file
  const goToNext = useCallback(() => {
    if (canGoNext && onNavigate) {
      onNavigate(currentIndex + 1);
    }
  }, [canGoNext, currentIndex, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, goToPrev, goToNext]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/80",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />

        {/* Content */}
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200"
          )}
          aria-label={`Просмотр файла: ${file.name}`}
        >
          {/* Header */}
          <FileViewerHeader
            fileName={file.name}
            fileUrl={file.url}
            currentIndex={currentIndex}
            totalFiles={files?.length}
            onClose={onClose}
          />

          {/* Main content area */}
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-background">
            {/* Navigation: Previous */}
            {hasNavigation && (
              <Button
                variant="ghost"
                size="icon"
                onClick={goToPrev}
                disabled={!canGoPrev}
                className={cn(
                  "absolute left-4 z-10 size-12 rounded-full bg-background/80 backdrop-blur-sm",
                  "transition-opacity hover:bg-background",
                  !canGoPrev && "opacity-30 cursor-not-allowed"
                )}
                aria-label="Предыдущий файл"
              >
                <ChevronLeft className="size-6" />
              </Button>
            )}

            {/* File content */}
            <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
              <FileViewerContent file={file} />
            </div>

            {/* Navigation: Next */}
            {hasNavigation && (
              <Button
                variant="ghost"
                size="icon"
                onClick={goToNext}
                disabled={!canGoNext}
                className={cn(
                  "absolute right-4 z-10 size-12 rounded-full bg-background/80 backdrop-blur-sm",
                  "transition-opacity hover:bg-background",
                  !canGoNext && "opacity-30 cursor-not-allowed"
                )}
                aria-label="Следующий файл"
              >
                <ChevronRight className="size-6" />
              </Button>
            )}
          </div>

          {/* Hidden title for accessibility (Radix requires it) */}
          <DialogPrimitive.Title className="sr-only">
            Просмотр файла: {file.name}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Просмотр содержимого файла {file.name}
          </DialogPrimitive.Description>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
