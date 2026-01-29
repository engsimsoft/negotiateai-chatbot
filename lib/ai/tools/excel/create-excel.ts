/**
 * createExcel tool - Create Excel files with formatting, formulas, and charts
 */

import { tool } from "ai";
import { z } from "zod";
import { put } from "@vercel/blob";
import ExcelJS from "exceljs";
import type { CreateExcelInput, CreateExcelOutput, ExcelData, ThemeId } from "./types";
import {
  getHeaderStyle,
  getAlternateRowStyle,
  getTotalRowStyle,
  numberFormats,
  defaultTheme,
} from "./styles";
import { isTotalRow, calculateColumnWidth, sanitizeFilename, convertToRowData } from "./utils";

// Input schema for AI
const createExcelSchema = z.object({
  filename: z.string().describe("Name of the Excel file (e.g., 'budget-january-2026.xlsx')"),
  sheets: z.array(
    z.object({
      name: z.string().describe("Sheet name (e.g., 'January', 'Summary')"),
      columns: z.array(
        z.object({
          header: z.string().describe("Column header text"),
          key: z.string().describe("Unique key for the column (used in data objects)"),
          width: z.number().optional().describe("Column width (default: auto)"),
          type: z
            .enum(["text", "number", "currency", "percent", "date"])
            .optional()
            .describe("Data type for formatting"),
        })
      ),
      data: z
        .array(z.record(z.any()))
        .describe("Array of row objects (keys match column keys)"),
      formulas: z
        .array(
          z.object({
            cell: z.string().describe("Cell reference (e.g., 'C2')"),
            formula: z.string().describe("Excel formula (e.g., '=SUM(B2:B10)')"),
          })
        )
        .optional()
        .describe("Formulas to add to specific cells"),
      charts: z
        .array(
          z.object({
            type: z
              .enum(["column", "bar", "line", "pie", "area", "doughnut"])
              .describe("Chart type"),
            title: z.string().describe("Chart title"),
            dataRange: z.string().describe("Data range (e.g., 'A1:B10')"),
            position: z.string().optional().describe("Position cell (e.g., 'E2')"),
          })
        )
        .optional()
        .describe("Charts to add to the sheet"),
      styles: z
        .object({
          theme: z
            .enum([
              "corporate-blue",
              "forest-green",
              "warm-orange",
              "professional-gray",
              "modern-teal",
            ])
            .optional()
            .describe("Color theme"),
          freezeHeader: z.boolean().optional().describe("Freeze header row"),
          alternateRows: z.boolean().optional().describe("Alternate row colors"),
        })
        .optional()
        .describe("Style settings"),
    })
  ),
});

/**
 * Create an Excel file and upload to Vercel Blob
 */
async function executeCreateExcel(input: CreateExcelInput): Promise<CreateExcelOutput> {
  const { filename, sheets } = input;
  const safeFilename = sanitizeFilename(filename);

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Simply AI";
  workbook.created = new Date();

  // Track data for artifact rendering
  const excelData: ExcelData = {
    filename: safeFilename,
    sheets: [],
  };

  for (const sheetConfig of sheets) {
    const worksheet = workbook.addWorksheet(sheetConfig.name);
    const themeId = (sheetConfig.styles?.theme || defaultTheme) as ThemeId;

    // Set up columns
    worksheet.columns = sheetConfig.columns.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width || calculateColumnWidth(col.header, sheetConfig.data, col.key),
    }));

    // Apply header styles
    const headerRow = worksheet.getRow(1);
    const headerStyle = getHeaderStyle(themeId);
    headerRow.eachCell((cell) => {
      cell.fill = headerStyle.fill;
      cell.font = headerStyle.font;
      cell.alignment = headerStyle.alignment;
      cell.border = headerStyle.border;
    });

    // Freeze header if requested
    if (sheetConfig.styles?.freezeHeader !== false) {
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
    }

    // Add data rows
    sheetConfig.data.forEach((rowData, rowIndex) => {
      const row = worksheet.addRow(rowData);
      const actualRowNumber = rowIndex + 2; // 1-indexed, skip header

      // Apply number formats based on column types
      sheetConfig.columns.forEach((col, colIndex) => {
        const cell = row.getCell(colIndex + 1);
        switch (col.type) {
          case "currency":
            cell.numFmt = numberFormats.currency;
            break;
          case "percent":
            cell.numFmt = numberFormats.percent;
            break;
          case "number":
            cell.numFmt = numberFormats.number;
            break;
          case "date":
            cell.numFmt = numberFormats.date;
            break;
        }

        // Align numbers to the right
        if (col.type && col.type !== "text") {
          cell.alignment = { horizontal: "right" };
        }
      });

      // Check if it's a total row
      if (isTotalRow(rowData, sheetConfig.columns)) {
        const totalStyle = getTotalRowStyle(themeId);
        row.eachCell((cell) => {
          cell.fill = totalStyle.fill;
          cell.font = totalStyle.font;
          cell.border = totalStyle.border;
        });
      } else if (sheetConfig.styles?.alternateRows !== false && rowIndex % 2 === 1) {
        // Apply alternate row styling
        const altStyle = getAlternateRowStyle(themeId);
        row.eachCell((cell) => {
          cell.fill = altStyle.fill;
        });
      }
    });

    // Add formulas
    if (sheetConfig.formulas) {
      for (const formulaConfig of sheetConfig.formulas) {
        const cell = worksheet.getCell(formulaConfig.cell);
        cell.value = { formula: formulaConfig.formula };
      }
    }

    // Note: ExcelJS chart support is limited, we'll handle charts in the UI artifact
    // Charts are stored in excelData for client-side rendering

    // Add to excelData for artifact rendering
    excelData.sheets.push({
      name: sheetConfig.name,
      columns: sheetConfig.columns,
      rows: convertToRowData(sheetConfig.data, sheetConfig.columns),
      charts: sheetConfig.charts,
      styles: sheetConfig.styles,
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Upload to Vercel Blob
  const blob = await put(safeFilename, buffer, {
    access: "public",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  excelData.fileUrl = blob.url;

  return {
    success: true,
    fileUrl: blob.url,
    filename: safeFilename,
    excelData,
  };
}

/**
 * createExcel tool for AI agents
 */
export const createExcel = tool({
  description: `Create a professional Excel file with formatting, formulas, and charts.

Features:
- Multiple sheets with custom names
- Column types: text, number, currency (₽), percent, date
- Formulas: SUM, AVERAGE, IF, VLOOKUP, and more
- 5 color themes: corporate-blue, forest-green, warm-orange, professional-gray, modern-teal
- Professional styling: frozen headers, alternate rows, total row highlighting
- Charts: column, bar, line, pie, area, doughnut

Russian localization:
- Currency: "15 000 ₽" format
- Numbers: space as thousands separator
- Dates: DD.MM.YYYY format

Example usage:
- "Сделай таблицу расходов за месяц" → Create budget table
- "Создай счёт для клиента с НДС" → Create invoice
- "Сделай медиаплан с ROI" → Create media plan`,

  inputSchema: createExcelSchema,

  execute: async (input) => {
    console.log("[Tool:createExcel] Starting execution");
    try {
      const result = await executeCreateExcel(input);
      console.log("[Tool:createExcel] Completed successfully");
      return result;
    } catch (error) {
      console.error("[Tool:createExcel] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
