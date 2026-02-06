"use client";

import { useMemo } from "react";
import { FileSpreadsheet, Presentation, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileRendererProps } from "../types";
import { getFileType } from "../utils";

/**
 * Рендерер для файлов с extractedContent (Excel, PPTX)
 *
 * Особенности:
 * - Отображает metadata.extractedContent
 * - Excel: пытается распознать табличную структуру
 * - PPTX: показывает текст слайдов с форматированием
 * - Fallback если extractedContent отсутствует
 */
export function ExtractedContentRenderer({ file, onLoad }: FileRendererProps) {
  const fileType = getFileType(file);
  const extractedContent = file.metadata?.extractedContent;

  // Сразу вызываем onLoad (контент уже в памяти)
  useMemo(() => {
    onLoad?.();
  }, [onLoad]);

  // Нет extractedContent — показываем fallback
  if (!extractedContent) {
    const Icon = fileType === "excel" ? FileSpreadsheet : Presentation;
    const label = fileType === "excel" ? "Excel файл" : "Презентация";

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
        <div className="rounded-2xl bg-muted p-6">
          <Icon className="size-16 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium">{file.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {label} — предпросмотр недоступен
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

  // Для Excel пробуем определить табличную структуру
  const isTabular = fileType === "excel" && looksLikeTable(extractedContent);

  if (isTabular) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {/* Stats bar */}
        <div className="flex items-center gap-4 border-b px-4 py-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="size-4" />
          <span>Извлечённое содержимое</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <TableView content={extractedContent} />
        </div>
      </div>
    );
  }

  // Для PPTX и обычного текста — formatted text
  const Icon = fileType === "excel" ? FileSpreadsheet : Presentation;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b px-4 py-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>Извлечённое содержимое</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <FormattedText content={extractedContent} isPptx={fileType === "presentation"} />
      </div>
    </div>
  );
}

/**
 * Проверяет, похож ли контент на таблицу
 * (строки с табуляциями или разделителями)
 */
function looksLikeTable(content: string): boolean {
  const lines = content.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return false;

  // Считаем табуляции или | в первых строках
  const firstLines = lines.slice(0, 5);
  const hasConsistentDelimiters = firstLines.every((line) => {
    const tabs = (line.match(/\t/g) || []).length;
    const pipes = (line.match(/\|/g) || []).length;
    return tabs >= 2 || pipes >= 2;
  });

  return hasConsistentDelimiters;
}

/**
 * Рендерит контент как таблицу
 */
function TableView({ content }: { content: string }) {
  const rows = useMemo(() => {
    const lines = content.split("\n").filter((line) => line.trim());
    return lines.map((line) => {
      // Пробуем разделить по табуляции, если не работает — по |
      let cells = line.split("\t");
      if (cells.length < 2) {
        cells = line.split("|").filter((cell) => cell.trim());
      }
      return cells.map((cell) => cell.trim());
    });
  }, [content]);

  if (rows.length === 0) return null;

  const headers = rows[0];
  const dataRows = rows.slice(1);

  return (
    <table className="w-full border-collapse text-sm">
      <thead className="sticky top-0 z-10 bg-muted">
        <tr>
          {headers.map((header, i) => (
            <th
              key={i}
              className="whitespace-nowrap border-b border-r px-3 py-2 text-left font-medium last:border-r-0"
            >
              {header || `Column ${i + 1}`}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dataRows.map((row, rowIndex) => (
          <tr key={rowIndex} className="hover:bg-muted/50">
            {headers.map((_, colIndex) => (
              <td
                key={colIndex}
                className="whitespace-nowrap border-b border-r px-3 py-2 last:border-r-0"
              >
                {row[colIndex] || ""}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Рендерит форматированный текст
 * Для PPTX добавляет разделение по слайдам
 */
function FormattedText({ content, isPptx }: { content: string; isPptx: boolean }) {
  if (isPptx) {
    // Пытаемся разбить по слайдам (ищем паттерны типа "Slide 1:", "--- Slide 1 ---")
    const slidePattern = /(?:^|\n)(?:---?\s*)?(?:Slide|Слайд)\s*\d+\s*(?:---?)?(?:\n|:)/gi;
    const parts = content.split(slidePattern);

    // Находим заголовки слайдов
    const slideMatches = content.match(slidePattern) || [];

    if (parts.length > 1 && slideMatches.length > 0) {
      return (
        <div className="space-y-6">
          {parts.map((part, i) => {
            if (!part.trim()) return null;
            const slideHeader = slideMatches[i - 1] || (i === 0 ? null : `Слайд ${i}`);
            return (
              <div key={i} className="rounded-lg border bg-muted/30 p-4">
                {slideHeader && (
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Presentation className="size-4" />
                    {slideHeader.replace(/[:\-\n]/g, "").trim()}
                  </div>
                )}
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                  {part.trim()}
                </pre>
              </div>
            );
          })}
        </div>
      );
    }
  }

  // Обычный текст с моношрифтом
  return (
    <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground">
      {content}
    </pre>
  );
}
