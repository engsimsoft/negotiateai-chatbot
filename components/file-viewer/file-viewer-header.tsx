"use client";

import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileViewerHeaderProps } from "./types";

/**
 * Header модалки FileViewer
 *
 * Layout: [✕ Close] — [File name (1/5)] — [⬇ Download]
 */
export function FileViewerHeader({
  fileName,
  fileUrl,
  currentIndex,
  totalFiles,
  onClose,
}: FileViewerHeaderProps) {
  // Показывать индикатор позиции только если есть навигация
  const showPosition = totalFiles !== undefined && totalFiles > 1;

  return (
    <header className="flex items-center justify-between gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
      {/* Left: Close button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="size-10 shrink-0"
        aria-label="Закрыть"
      >
        <X className="size-5" />
      </Button>

      {/* Center: File name + position indicator */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center">
        <span className="max-w-full truncate text-sm font-medium">
          {fileName}
        </span>
        {showPosition && currentIndex !== undefined && (
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {totalFiles}
          </span>
        )}
      </div>

      {/* Right: Download button */}
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="shrink-0 gap-2"
      >
        <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
          <Download className="size-4" />
          <span className="hidden sm:inline">Скачать</span>
        </a>
      </Button>
    </header>
  );
}
