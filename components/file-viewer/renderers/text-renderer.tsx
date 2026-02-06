"use client";

import { useState, useEffect } from "react";
import { FileText, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { FileRendererProps } from "../types";

const MAX_TEXT_SIZE = 500 * 1024; // 500KB

/**
 * Рендерер для текстовых файлов (.txt, .log, etc.)
 *
 * Особенности:
 * - Fetch содержимого файла
 * - Моноширинный шрифт для читаемости
 * - Ограничение 500KB (показывает частично + "Скачать полный файл")
 * - Loading/Error состояния
 */
export function TextRenderer({ file, onLoad, onError }: FileRendererProps) {
  const [content, setContent] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();

        if (text.length > MAX_TEXT_SIZE) {
          setContent(text.slice(0, MAX_TEXT_SIZE));
          setIsTruncated(true);
        } else {
          setContent(text);
          setIsTruncated(false);
        }

        setStatus("success");
        onLoad?.();
      } catch (err) {
        console.error("Failed to load text file:", err);
        setStatus("error");
        onError?.();
      }
    };

    fetchContent();
  }, [file.url, onLoad, onError]);

  // Loading state
  if (status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="size-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
        <div className="rounded-2xl bg-muted p-6">
          <AlertCircle className="size-16 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium">{file.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Не удалось загрузить файл
          </p>
        </div>
        <Button size="lg" className="gap-2" asChild>
          <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
            <Download className="size-5" />
            Скачать файл
          </a>
        </Button>
      </div>
    );
  }

  // Success state
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground">
          {content}
        </pre>

        {/* Truncation notice */}
        {isTruncated && (
          <div className="mt-6 flex flex-col items-center gap-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="size-4" />
              <span>Файл обрезан (показано первые 500 КБ)</span>
            </div>
            <Button variant="outline" className="gap-2" asChild>
              <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
                <Download className="size-4" />
                Скачать полный файл
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
