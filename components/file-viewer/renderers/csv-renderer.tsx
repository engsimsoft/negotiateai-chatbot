"use client";

import { useState, useEffect, useMemo } from "react";
import { Table, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { FileRendererProps } from "../types";

const MAX_TEXT_SIZE = 500 * 1024; // 500KB
const MAX_ROWS = 1000; // Максимум строк для отображения

/**
 * Простой парсер CSV
 * Обрабатывает: запятые, кавычки, переносы строк в кавычках
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentCell += '"';
          i++;
        } else {
          // End of quoted field
          insideQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === ",") {
        currentRow.push(currentCell.trim());
        currentCell = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentRow.push(currentCell.trim());
        if (currentRow.length > 0 && currentRow.some((cell) => cell !== "")) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = "";
        if (char === "\r") i++; // Skip \n in \r\n
      } else if (char !== "\r") {
        currentCell += char;
      }
    }
  }

  // Push last row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Рендерер для CSV файлов
 *
 * Особенности:
 * - Fetch и парсинг CSV
 * - Отображение как таблица с заголовком
 * - Ограничение 500KB и 1000 строк
 * - Горизонтальный скролл для широких таблиц
 * - Loading/Error состояния
 */
export function CsvRenderer({ file, onLoad, onError }: FileRendererProps) {
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [isTruncated, setIsTruncated] = useState(false);
  const [rowsTruncated, setRowsTruncated] = useState(false);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const response = await fetch(file.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        let text = await response.text();

        if (text.length > MAX_TEXT_SIZE) {
          text = text.slice(0, MAX_TEXT_SIZE);
          setIsTruncated(true);
        }

        setRawContent(text);
        setStatus("success");
        onLoad?.();
      } catch (err) {
        console.error("Failed to load CSV file:", err);
        setStatus("error");
        onError?.();
      }
    };

    fetchContent();
  }, [file.url, onLoad, onError]);

  // Parse CSV
  const { headers, rows } = useMemo(() => {
    if (!rawContent) return { headers: [], rows: [] };

    const allRows = parseCSV(rawContent);
    if (allRows.length === 0) return { headers: [], rows: [] };

    const headers = allRows[0];
    let dataRows = allRows.slice(1);

    if (dataRows.length > MAX_ROWS) {
      dataRows = dataRows.slice(0, MAX_ROWS);
      setRowsTruncated(true);
    }

    return { headers, rows: dataRows };
  }, [rawContent]);

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

  // Empty state
  if (headers.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
        <div className="rounded-2xl bg-muted p-6">
          <Table className="size-16 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium">{file.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Файл пуст или имеет неверный формат
          </p>
        </div>
        <Button variant="outline" className="gap-2" asChild>
          <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
            <Download className="size-4" />
            Скачать файл
          </a>
        </Button>
      </div>
    );
  }

  // Success state — table
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b px-4 py-2 text-sm text-muted-foreground">
        <span>{rows.length} строк</span>
        <span>×</span>
        <span>{headers.length} колонок</span>
      </div>

      {/* Table container */}
      <div className="flex-1 overflow-auto">
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
            {rows.map((row, rowIndex) => (
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
      </div>

      {/* Truncation notice */}
      {(isTruncated || rowsTruncated) && (
        <div className="flex items-center justify-between gap-4 border-t bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Table className="size-4" />
            <span>
              {rowsTruncated
                ? `Показано первые ${MAX_ROWS} строк`
                : "Файл обрезан (показано первые 500 КБ)"}
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
              <Download className="size-4" />
              Скачать полный файл
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
