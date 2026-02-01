/**
 * Excel Document Handler - Server-side processing for Excel artifacts
 */

import { createDocumentHandler } from "@/lib/artifacts/server";
import { streamText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { put } from "@vercel/blob";
import ExcelJS from "exceljs";
import type { ExcelData, ExcelSheet, ThemeId } from "@/lib/ai/tools/excel/types";
import {
  getHeaderStyle,
  getAlternateRowStyle,
  getTotalRowStyle,
  numberFormats,
  defaultTheme,
} from "@/lib/ai/tools/excel/styles";
import { isTotalRow, calculateColumnWidth, convertToRowData } from "@/lib/ai/tools/excel/utils";
import { templatesList, getTemplate } from "@/lib/ai/tools/excel/templates";

// System prompt for Excel generation
const EXCEL_SYSTEM_PROMPT = `Ты помощник для создания профессиональных Excel-таблиц.

Твоя задача: проанализировать запрос пользователя и сгенерировать JSON со структурой таблицы.

ДОСТУПНЫЕ ШАБЛОНЫ:
${templatesList.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

ФОРМАТ ОТВЕТА (только JSON, без markdown):
{
  "filename": "название-файла.xlsx",
  "sheets": [{
    "name": "Название листа",
    "columns": [
      { "header": "Название колонки", "key": "ключ", "type": "text|number|currency|percent|date", "width": 15 }
    ],
    "data": [
      { "ключ": "значение", ... }
    ],
    "formulas": [
      { "cell": "C2", "formula": "=B2*0.2" }
    ],
    "styles": {
      "theme": "corporate-blue|forest-green|warm-orange|professional-gray|modern-teal",
      "freezeHeader": true,
      "alternateRows": true
    }
  }]
}

ПРАВИЛА:
1. Используй русские названия колонок и данных
2. Для денег используй type: "currency" (формат: "15 000 ₽")
3. Для процентов используй type: "percent" (формат: "68%")
4. Для дат используй type: "date" (формат: DD.MM.YYYY)
5. Добавляй формулы для автоподсчёта (SUM, AVERAGE, IF)
6. Добавляй итоговую строку где уместно
7. Выбирай подходящую цветовую тему
8. Если запрос похож на шаблон — используй его структуру

ОТВЕЧАЙ ТОЛЬКО JSON, без пояснений и markdown.`;

/**
 * Generate Excel workbook from ExcelData
 */
async function generateWorkbook(excelData: ExcelData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Simply AI";
  workbook.created = new Date();

  for (const sheetConfig of excelData.sheets as ExcelSheet[]) {
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

    // Freeze header
    if (sheetConfig.styles?.freezeHeader !== false) {
      worksheet.views = [{ state: "frozen", ySplit: 1 }];
    }

    // Add data rows
    sheetConfig.data.forEach((rowData, rowIndex) => {
      const row = worksheet.addRow(rowData);

      // Apply number formats
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

        if (col.type && col.type !== "text") {
          cell.alignment = { horizontal: "right" };
        }
      });

      // Style total row or alternate rows
      if (isTotalRow(rowData, sheetConfig.columns)) {
        const totalStyle = getTotalRowStyle(themeId);
        row.eachCell((cell) => {
          cell.fill = totalStyle.fill;
          cell.font = totalStyle.font;
          cell.border = totalStyle.border;
        });
      } else if (sheetConfig.styles?.alternateRows !== false && rowIndex % 2 === 1) {
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
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Excel Document Handler
 */
export const excelDocumentHandler = createDocumentHandler<"excel">({
  kind: "excel",

  onCreateDocument: async ({ id, title, dataStream, session }) => {
    // Check if title matches a template
    const template = getTemplate(title);

    let excelData: ExcelData;

    if (template) {
      // Use template directly
      excelData = {
        filename: `${template.id}.xlsx`,
        sheets: template.sheets,
      };
    } else {
      // Generate with AI
      const { fullStream } = streamText({
        model: myProvider.languageModel("artifact-model"),
        system: EXCEL_SYSTEM_PROMPT,
        prompt: title,
      });

      // Performance: Use array.join instead of string concatenation
      const chunks: string[] = [];
      for await (const delta of fullStream) {
        if (delta.type === "text-delta") {
          chunks.push(delta.text);
        }
      }
      const jsonContent = chunks.join("");

      // Parse JSON response
      try {
        // Clean up potential markdown code blocks
        const cleanJson = jsonContent
          .replace(/^```json\n?/m, "")
          .replace(/^```\n?/m, "")
          .replace(/\n?```$/m, "")
          .trim();

        excelData = JSON.parse(cleanJson);
      } catch (e) {
        console.error("[Excel Handler] Failed to parse JSON:", e);
        // Return minimal fallback
        excelData = {
          filename: "document.xlsx",
          sheets: [
            {
              name: "Лист1",
              columns: [
                { header: "Данные", key: "data", type: "text" },
              ],
              data: [{ data: "Не удалось создать таблицу. Попробуйте уточнить запрос." }],
            },
          ],
        };
      }
    }

    // Generate workbook and upload
    const buffer = await generateWorkbook(excelData);
    const filename = excelData.filename || `${id}.xlsx`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    excelData.fileUrl = blob.url;

    // Add row data for UI rendering
    excelData.sheets = excelData.sheets.map((sheet) => ({
      ...sheet,
      rows: convertToRowData(sheet.data || [], sheet.columns),
    }));

    // Send to client
    dataStream.write({
      type: "data-excelDelta",
      data: {
        excelData: JSON.stringify(excelData),
        fileUrl: blob.url,
        isComplete: true,
      },
      transient: true,
    });

    // Return content for DB storage
    return JSON.stringify(excelData);
  },

  onUpdateDocument: async ({ document, description, dataStream, session }) => {
    // Parse existing content
    let excelData: ExcelData;
    try {
      excelData = JSON.parse(document.content || "{}");
    } catch {
      return document.content || "";
    }

    // Generate update with AI
    const { fullStream } = streamText({
      model: myProvider.languageModel("artifact-model"),
      system: `${EXCEL_SYSTEM_PROMPT}

ТЕКУЩАЯ ТАБЛИЦА:
${JSON.stringify(excelData, null, 2)}

ЗАДАЧА: Обнови таблицу согласно запросу пользователя. Верни ПОЛНЫЙ обновлённый JSON.`,
      prompt: description,
    });

    // Performance: Use array.join instead of string concatenation
    const chunks: string[] = [];
    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        chunks.push(delta.text);
      }
    }
    const jsonContent = chunks.join("");

    // Parse updated JSON
    try {
      const cleanJson = jsonContent
        .replace(/^```json\n?/m, "")
        .replace(/^```\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();

      excelData = JSON.parse(cleanJson);
    } catch (e) {
      console.error("[Excel Handler] Failed to parse update JSON:", e);
      return document.content || "";
    }

    // Generate new workbook and upload
    const buffer = await generateWorkbook(excelData);
    const filename = excelData.filename || `${document.id}.xlsx`;

    const blob = await put(filename, buffer, {
      access: "public",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    excelData.fileUrl = blob.url;

    // Add row data for UI rendering
    excelData.sheets = excelData.sheets.map((sheet) => ({
      ...sheet,
      rows: convertToRowData(sheet.data || [], sheet.columns),
    }));

    // Send to client
    dataStream.write({
      type: "data-excelDelta",
      data: {
        excelData: JSON.stringify(excelData),
        fileUrl: blob.url,
        isComplete: true,
      },
      transient: true,
    });

    return JSON.stringify(excelData);
  },
});
