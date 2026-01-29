/**
 * editExcel tool - Edit existing Excel documents
 */

import { tool } from "ai";
import { z } from "zod";
import { put } from "@vercel/blob";
import ExcelJS from "exceljs";
import type { EditExcelInput, EditExcelOutput, ExcelData, ThemeId } from "./types";
import {
  getHeaderStyle,
  getAlternateRowStyle,
  getTotalRowStyle,
  numberFormats,
} from "./styles";
import { convertToRowData, parseCellReference, getColumnLetter } from "./utils";

// Input schema for AI
const editExcelSchema = z.object({
  documentId: z.string().describe("Document ID of the Excel artifact to edit"),
  operations: z.array(
    z.object({
      type: z
        .enum([
          "addColumn",
          "addRow",
          "updateCell",
          "addFormula",
          "addChart",
          "deleteColumn",
          "deleteRow",
          "updateStyle",
        ])
        .describe("Type of edit operation"),
      sheet: z.string().optional().describe("Sheet name (defaults to first sheet)"),
      // For addColumn
      column: z
        .object({
          header: z.string(),
          key: z.string(),
          width: z.number().optional(),
          type: z.enum(["text", "number", "currency", "percent", "date"]).optional(),
        })
        .optional(),
      position: z.number().optional().describe("Column position for insertion"),
      // For addRow
      rowData: z.record(z.any()).optional().describe("Data for new row"),
      rowIndex: z.number().optional().describe("Row index for insertion"),
      // For updateCell
      cell: z.string().optional().describe("Cell reference (e.g., 'B3')"),
      value: z.any().optional().describe("New cell value"),
      // For addFormula
      formula: z
        .object({
          cell: z.string(),
          formula: z.string(),
        })
        .optional(),
      // For addChart
      chart: z
        .object({
          type: z.enum(["column", "bar", "line", "pie", "area", "doughnut"]),
          title: z.string(),
          dataRange: z.string(),
          position: z.string().optional(),
        })
        .optional(),
      // For deleteColumn
      columnKey: z.string().optional().describe("Column key to delete"),
      // For updateStyle
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
            .optional(),
          freezeHeader: z.boolean().optional(),
          alternateRows: z.boolean().optional(),
        })
        .optional(),
    })
  ),
});

// This will be passed from the artifact context
interface EditExcelContext {
  session: { user?: { id?: string } };
  getDocument: (id: string) => Promise<{
    id: string;
    content: string;
    title: string;
    kind: string;
  } | null>;
  saveDocument: (params: {
    id: string;
    title: string;
    content: string;
    kind: string;
    userId: string;
  }) => Promise<void>;
}

/**
 * Edit an Excel document
 * Note: This function expects to receive document data via the artifact system
 */
async function executeEditExcel(
  input: EditExcelInput,
  context?: EditExcelContext
): Promise<EditExcelOutput> {
  const { documentId, operations } = input;

  // In a real implementation, we would:
  // 1. Load the existing document from DB
  // 2. Parse the stored Excel data
  // 3. Apply operations
  // 4. Save back to DB and Blob

  // For now, return a placeholder that the artifact system will handle
  return {
    success: true,
    error: "Edit operations are applied through the artifact update system",
  };
}

/**
 * Apply edit operations to a workbook
 */
export async function applyOperations(
  workbook: ExcelJS.Workbook,
  operations: EditExcelInput["operations"],
  existingData: ExcelData
): Promise<ExcelData> {
  const updatedData = { ...existingData };

  for (const op of operations) {
    const sheetName = op.sheet || workbook.worksheets[0]?.name;
    const worksheet = workbook.getWorksheet(sheetName);

    if (!worksheet) {
      console.warn(`Sheet "${sheetName}" not found`);
      continue;
    }

    const sheetIndex = updatedData.sheets.findIndex((s) => s.name === sheetName);
    if (sheetIndex === -1) continue;

    switch (op.type) {
      case "addColumn":
        if (op.column) {
          // Add column to worksheet
          const colNumber = op.position || worksheet.columnCount + 1;
          worksheet.spliceColumns(colNumber, 0, [op.column.header]);

          // Update excelData
          if (op.position !== undefined) {
            updatedData.sheets[sheetIndex].columns.splice(op.position, 0, op.column);
          } else {
            updatedData.sheets[sheetIndex].columns.push(op.column);
          }
        }
        break;

      case "addRow":
        if (op.rowData) {
          const rowIndex = op.rowIndex || worksheet.rowCount + 1;
          worksheet.insertRow(rowIndex, op.rowData);

          // Update excelData
          const rowData = convertToRowData(
            [op.rowData],
            updatedData.sheets[sheetIndex].columns
          )[0];
          // Initialize rows array if not present
          if (!updatedData.sheets[sheetIndex].rows) {
            updatedData.sheets[sheetIndex].rows = [];
          }
          if (op.rowIndex !== undefined) {
            updatedData.sheets[sheetIndex].rows.splice(op.rowIndex, 0, rowData);
          } else {
            updatedData.sheets[sheetIndex].rows.push(rowData);
          }
        }
        break;

      case "updateCell":
        if (op.cell && op.value !== undefined) {
          const cell = worksheet.getCell(op.cell);
          cell.value = op.value as ExcelJS.CellValue;

          // Update excelData
          const cellRef = parseCellReference(op.cell);
          if (cellRef && updatedData.sheets[sheetIndex].rows) {
            const col = updatedData.sheets[sheetIndex].columns[cellRef.col];
            if (col && updatedData.sheets[sheetIndex].rows[cellRef.row - 1]) {
              updatedData.sheets[sheetIndex].rows[cellRef.row - 1][col.key] = {
                value: op.value,
                type: col.type || "text",
                formatted: String(op.value),
              };
            }
          }
        }
        break;

      case "addFormula":
        if (op.formula) {
          const cell = worksheet.getCell(op.formula.cell);
          cell.value = { formula: op.formula.formula };

          // Update excelData
          const cellRef = parseCellReference(op.formula.cell);
          if (cellRef && updatedData.sheets[sheetIndex].rows) {
            const col = updatedData.sheets[sheetIndex].columns[cellRef.col];
            if (col && updatedData.sheets[sheetIndex].rows[cellRef.row - 1]) {
              updatedData.sheets[sheetIndex].rows[cellRef.row - 1][col.key] = {
                value: null,
                type: col.type || "text",
                formula: op.formula.formula,
                formatted: `=${op.formula.formula}`,
              };
            }
          }
        }
        break;

      case "addChart":
        if (op.chart) {
          // Charts are stored in excelData for client-side rendering
          if (!updatedData.sheets[sheetIndex].charts) {
            updatedData.sheets[sheetIndex].charts = [];
          }
          updatedData.sheets[sheetIndex].charts!.push(op.chart);
        }
        break;

      case "deleteColumn":
        if (op.columnKey) {
          const colIndex = updatedData.sheets[sheetIndex].columns.findIndex(
            (c) => c.key === op.columnKey
          );
          if (colIndex !== -1) {
            worksheet.spliceColumns(colIndex + 1, 1);
            updatedData.sheets[sheetIndex].columns.splice(colIndex, 1);

            // Remove column data from rows
            if (updatedData.sheets[sheetIndex].rows) {
              updatedData.sheets[sheetIndex].rows.forEach((row) => {
                delete row[op.columnKey!];
              });
            }
          }
        }
        break;

      case "deleteRow":
        if (op.rowIndex !== undefined && updatedData.sheets[sheetIndex].rows) {
          worksheet.spliceRows(op.rowIndex + 2, 1); // +2 for 1-indexed and header
          updatedData.sheets[sheetIndex].rows.splice(op.rowIndex, 1);
        }
        break;

      case "updateStyle":
        if (op.styles) {
          updatedData.sheets[sheetIndex].styles = {
            ...updatedData.sheets[sheetIndex].styles,
            ...op.styles,
          };

          // Apply styles to worksheet
          const themeId = op.styles.theme as ThemeId | undefined;
          if (themeId) {
            const headerStyle = getHeaderStyle(themeId);
            const headerRow = worksheet.getRow(1);
            headerRow.eachCell((cell) => {
              cell.fill = headerStyle.fill;
              cell.font = headerStyle.font;
            });
          }

          if (op.styles.freezeHeader !== undefined) {
            worksheet.views = op.styles.freezeHeader
              ? [{ state: "frozen", ySplit: 1 }]
              : [];
          }
        }
        break;
    }
  }

  return updatedData;
}

/**
 * Save workbook to Vercel Blob
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  filename: string
): Promise<string> {
  const buffer = await workbook.xlsx.writeBuffer();

  const blob = await put(filename, buffer, {
    access: "public",
    contentType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  return blob.url;
}

/**
 * editExcel tool for AI agents
 */
export const editExcel = tool({
  description: `Edit an existing Excel document through operations.

Operations:
- addColumn: Add a new column at specified position
- addRow: Add a new row with data
- updateCell: Change value of a specific cell
- addFormula: Add a formula to a cell
- addChart: Add a chart to the sheet
- deleteColumn: Remove a column by key
- deleteRow: Remove a row by index
- updateStyle: Change theme, freeze headers, or alternate rows

Use this for iterative editing:
- "Добавь колонку с НДС"
- "Добавь строку итого"
- "Измени значение в ячейке B3"
- "Добавь круговую диаграмму"
- "Поменяй цветовую схему на зелёную"`,

  inputSchema: editExcelSchema,

  execute: async (input) => {
    console.log("[Tool:editExcel] Starting execution");
    try {
      const result = await executeEditExcel(input);
      console.log("[Tool:editExcel] Completed successfully");
      return result;
    } catch (error) {
      console.error("[Tool:editExcel] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});
