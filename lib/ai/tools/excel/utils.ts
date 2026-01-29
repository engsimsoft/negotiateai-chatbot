/**
 * Excel utilities for formatting and conversions
 */

import type { ColumnType, ExcelColumn, ExcelRowData, ExcelCellData } from "./types";
import { formatNumber, formatCurrency, formatPercent, formatDate } from "./styles";

/**
 * Format a value based on column type
 */
export function formatValue(value: unknown, type: ColumnType): string {
  if (value === null || value === undefined) {
    return "";
  }

  switch (type) {
    case "number":
      return formatNumber(Number(value));
    case "currency":
      return formatCurrency(Number(value));
    case "percent":
      return formatPercent(Number(value));
    case "date":
      return formatDate(value as string | Date);
    case "text":
    default:
      return String(value);
  }
}

/**
 * Convert raw data to ExcelRowData with cell metadata
 */
export function convertToRowData(
  data: Record<string, unknown>[],
  columns: ExcelColumn[]
): ExcelRowData[] {
  return data.map((row) => {
    const rowData: ExcelRowData = {};
    columns.forEach((col) => {
      const value = row[col.key];
      rowData[col.key] = {
        value,
        type: col.type || "text",
        formatted: formatValue(value, col.type || "text"),
      };
    });
    return rowData;
  });
}

/**
 * Generate column letter from index (0 -> A, 1 -> B, 26 -> AA, etc.)
 */
export function getColumnLetter(index: number): string {
  let letter = "";
  let i = index;
  while (i >= 0) {
    letter = String.fromCharCode((i % 26) + 65) + letter;
    i = Math.floor(i / 26) - 1;
  }
  return letter;
}

/**
 * Parse cell reference (e.g., "A1" -> { col: 0, row: 0 })
 */
export function parseCellReference(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const colStr = match[1];
  const rowStr = match[2];

  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + colStr.charCodeAt(i) - 64;
  }
  col -= 1; // 0-indexed

  const row = parseInt(rowStr, 10) - 1; // 0-indexed

  return { col, row };
}

/**
 * Generate a cell reference from column and row (0-indexed)
 */
export function getCellReference(col: number, row: number): string {
  return `${getColumnLetter(col)}${row + 1}`;
}

/**
 * Detect if a value looks like a total/sum row
 */
export function isTotalRow(row: Record<string, unknown>, columns: ExcelColumn[]): boolean {
  const firstCol = columns[0]?.key;
  if (!firstCol) return false;

  const firstValue = String(row[firstCol] || "").toLowerCase();
  return (
    firstValue.includes("итого") ||
    firstValue.includes("всего") ||
    firstValue.includes("total") ||
    firstValue.includes("sum")
  );
}

/**
 * Calculate default column width based on header and data
 */
export function calculateColumnWidth(
  header: string,
  data: Record<string, unknown>[],
  key: string
): number {
  let maxLength = header.length;
  data.forEach((row) => {
    const value = String(row[key] || "");
    maxLength = Math.max(maxLength, value.length);
  });
  // Add some padding and cap at reasonable width
  return Math.min(Math.max(maxLength + 2, 10), 50);
}

/**
 * Generate SUM formula for a column
 */
export function generateSumFormula(columnLetter: string, startRow: number, endRow: number): string {
  return `=SUM(${columnLetter}${startRow}:${columnLetter}${endRow})`;
}

/**
 * Generate AVERAGE formula for a column
 */
export function generateAverageFormula(columnLetter: string, startRow: number, endRow: number): string {
  return `=AVERAGE(${columnLetter}${startRow}:${columnLetter}${endRow})`;
}

/**
 * Generate percent formula (value / total)
 */
export function generatePercentFormula(valueCell: string, totalCell: string): string {
  return `=${valueCell}/${totalCell}`;
}

/**
 * Sanitize filename for Excel
 */
export function sanitizeFilename(filename: string): string {
  // Remove invalid characters and ensure .xlsx extension
  const sanitized = filename
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();

  if (!sanitized.endsWith(".xlsx")) {
    return sanitized.replace(/\.(xlsx|xls)$/i, "") + ".xlsx";
  }
  return sanitized;
}

/**
 * Convert ExcelJS workbook to JSON for artifact rendering
 */
export function workbookToJson(workbook: unknown): Record<string, unknown>[] {
  // This will be implemented when we integrate with ExcelJS
  return [];
}

/**
 * Parse range string (e.g., "A1:B10") to start and end cells
 */
export function parseRange(range: string): {
  start: { col: number; row: number };
  end: { col: number; row: number };
} | null {
  const parts = range.split(":");
  if (parts.length !== 2) return null;

  const start = parseCellReference(parts[0]);
  const end = parseCellReference(parts[1]);

  if (!start || !end) return null;

  return { start, end };
}

/**
 * Detect column type from values
 */
export function detectColumnType(values: unknown[]): ColumnType {
  // Filter out null/undefined
  const validValues = values.filter((v) => v !== null && v !== undefined);
  if (validValues.length === 0) return "text";

  // Check if all values are numbers
  const allNumbers = validValues.every((v) => !isNaN(Number(v)));
  if (!allNumbers) return "text";

  // Check for currency patterns (contains ₽ or ends with rubles words)
  const hasCurrency = validValues.some((v) => {
    const str = String(v);
    return str.includes("₽") || str.includes("руб");
  });
  if (hasCurrency) return "currency";

  // Check for percent patterns
  const hasPercent = validValues.some((v) => {
    const str = String(v);
    return str.includes("%");
  });
  if (hasPercent) return "percent";

  // Check for date patterns (DD.MM.YYYY or ISO)
  const hasDate = validValues.some((v) => {
    const str = String(v);
    return /^\d{2}\.\d{2}\.\d{4}$/.test(str) || /^\d{4}-\d{2}-\d{2}/.test(str);
  });
  if (hasDate) return "date";

  return "number";
}
