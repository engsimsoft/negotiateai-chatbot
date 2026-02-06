"use client";

import { useState } from "react";
import { FileText, ExternalLink, Download } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileRendererProps } from "../types";

/**
 * Рендерер для PDF файлов
 *
 * Особенности:
 * - iframe с встроенным PDF viewer браузера
 * - Loading состояние со спиннером
 * - Fallback кнопки (открыть в новой вкладке, скачать)
 *
 * Примечание: Определить ошибку загрузки PDF через iframe сложно,
 * поэтому всегда показываем fallback кнопки внизу.
 */
export function PdfRenderer({ file, onLoad, onError }: FileRendererProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleLoad = () => {
    setIsLoading(false);
    onLoad?.();
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* PDF iframe container */}
      <div className="relative flex-1">
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Загрузка PDF...</p>
            </div>
          </div>
        )}

        {/* PDF iframe */}
        <iframe
          src={file.url}
          title={file.name}
          className="h-full w-full border-0"
          onLoad={handleLoad}
        />
      </div>

      {/* Fallback actions bar */}
      <div className="flex items-center justify-center gap-3 border-t bg-muted/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">
          Проблемы с отображением?
        </span>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href={file.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Открыть в новой вкладке
          </a>
        </Button>
        <Button variant="outline" size="sm" className="gap-2" asChild>
          <a href={file.url} download={file.name}>
            <Download className="size-4" />
            Скачать
          </a>
        </Button>
      </div>
    </div>
  );
}
