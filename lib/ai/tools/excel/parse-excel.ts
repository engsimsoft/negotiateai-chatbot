/**
 * parseExcel tool - Read and analyze uploaded Excel files
 */

import { tool } from "ai";
import { z } from "zod";
import ExcelJS from "exceljs";
import type { ParseExcelInput, ParseExcelOutput, ParsedSheet } from "./types";
import { detectColumnType } from "./utils";

// Input schema for AI
const parseExcelSchema = z.object({
  fileUrl: z.string().url().describe("URL of the Excel file to parse (from Vercel Blob)"),
});

/**
 * Parse an Excel file from URL
 */
async function executeParseExcel(input: ParseExcelInput): Promise<ParseExcelOutput> {
  const { fileUrl } = input;

  // Fetch file from URL
  const response = await fetch(fileUrl);
  if (!response.ok) {
    return {
      success: false,
      error: `Failed to fetch file: ${response.status} ${response.statusText}`,
    };
  }

  const arrayBuffer = await response.arrayBuffer();

  // Parse with ExcelJS
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // Extract filename from URL
  const urlParts = fileUrl.split("/");
  const filename = urlParts[urlParts.length - 1].split("?")[0] || "document.xlsx";

  const sheets: ParsedSheet[] = [];

  workbook.eachSheet((worksheet) => {
    const columns: string[] = [];
    const preview: Record<string, unknown>[] = [];
    const formulas: string[] = [];
    let rowCount = 0;
    let columnCount = 0;

    // Get header row (first row)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      columns.push(String(cell.value || `Column${colNumber}`));
      columnCount = Math.max(columnCount, colNumber);
    });

    // Get data rows (up to 10 for preview)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      rowCount++;

      if (rowCount <= 10) {
        const rowData: Record<string, unknown> = {};
        row.eachCell((cell, colNumber) => {
          const colName = columns[colNumber - 1] || `Column${colNumber}`;

          // Check for formula
          if (cell.formula) {
            formulas.push(`${cell.address}: =${cell.formula}`);
            rowData[colName] = cell.result || cell.value;
          } else {
            rowData[colName] = cell.value;
          }
        });
        preview.push(rowData);
      } else {
        // Still collect formulas from remaining rows
        row.eachCell((cell) => {
          if (cell.formula && formulas.length < 20) {
            formulas.push(`${cell.address}: =${cell.formula}`);
          }
        });
      }
    });

    // Generate summary
    const summary = generateSheetSummary(worksheet.name, columns, preview, rowCount);

    sheets.push({
      name: worksheet.name,
      rowCount,
      columnCount,
      columns,
      preview,
      formulas: [...new Set(formulas)], // Unique formulas
      summary,
    });
  });

  return {
    success: true,
    filename,
    sheets,
  };
}

/**
 * Generate a human-readable summary of a sheet
 */
function generateSheetSummary(
  sheetName: string,
  columns: string[],
  preview: Record<string, unknown>[],
  totalRows: number
): string {
  const parts: string[] = [];

  parts.push(`Лист "${sheetName}": ${totalRows} строк, ${columns.length} колонок.`);
  parts.push(`Колонки: ${columns.join(", ")}.`);

  // Analyze numeric columns
  const numericColumns: string[] = [];
  const currencyColumns: string[] = [];

  columns.forEach((col) => {
    const values = preview.map((row) => row[col]).filter((v) => v !== null && v !== undefined);
    const type = detectColumnType(values);

    if (type === "currency") {
      currencyColumns.push(col);
    } else if (type === "number") {
      numericColumns.push(col);
    }
  });

  if (currencyColumns.length > 0) {
    parts.push(`Денежные колонки: ${currencyColumns.join(", ")}.`);
  }

  if (numericColumns.length > 0) {
    parts.push(`Числовые колонки: ${numericColumns.join(", ")}.`);
  }

  // Calculate totals for numeric columns
  if (preview.length > 0 && (numericColumns.length > 0 || currencyColumns.length > 0)) {
    const allNumeric = [...numericColumns, ...currencyColumns];
    const totals: string[] = [];

    allNumeric.slice(0, 3).forEach((col) => {
      const sum = preview.reduce((acc, row) => {
        const val = Number(row[col]);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      if (sum > 0) {
        totals.push(`${col}: ${sum.toLocaleString("ru-RU")}`);
      }
    });

    if (totals.length > 0) {
      parts.push(`Суммы (preview): ${totals.join("; ")}.`);
    }
  }

  return parts.join(" ");
}

/**
 * parseExcel tool for AI agents
 */
export const parseExcel = tool({
  description: `Read and analyze an uploaded Excel file.

Returns:
- Sheet names and structure
- Column headers and types
- Preview of first 10 rows
- Formulas found in the file
- Summary of each sheet

Use this to:
- Answer questions about the file content ("Какой итог за март?")
- Understand file structure before editing
- Analyze data patterns`,

  inputSchema: parseExcelSchema,

  execute: async (input) => {
    console.log("[Tool:parseExcel] Starting execution");
    try {
      const result = await executeParseExcel(input);
      console.log("[Tool:parseExcel] Completed successfully");
      return result;
    } catch (error) {
      console.error("[Tool:parseExcel] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
