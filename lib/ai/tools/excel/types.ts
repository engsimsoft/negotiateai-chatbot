/**
 * TypeScript types for Excel Tool
 */

// Column types for data formatting
export type ColumnType = "text" | "number" | "currency" | "percent" | "date";

// Chart types supported
export type ChartType = "column" | "bar" | "line" | "pie" | "area" | "doughnut";

// Color themes
export type ThemeId =
  | "corporate-blue"
  | "forest-green"
  | "warm-orange"
  | "professional-gray"
  | "modern-teal";

// Column definition
export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  type?: ColumnType;
}

// Formula definition
export interface ExcelFormula {
  cell: string; // e.g., "C2"
  formula: string; // e.g., "=SUM(B2:B10)"
}

// Chart definition
export interface ExcelChart {
  type: ChartType;
  title: string;
  dataRange: string; // e.g., "A1:B10"
  position?: string; // e.g., "E2"
}

// Style configuration
export interface ExcelStyles {
  theme?: ThemeId;
  freezeHeader?: boolean;
  alternateRows?: boolean;
}

// Sheet definition
export interface ExcelSheet {
  name: string;
  columns: ExcelColumn[];
  data: Record<string, unknown>[];
  formulas?: ExcelFormula[];
  charts?: ExcelChart[];
  styles?: ExcelStyles;
}

// Input for createExcel tool
export interface CreateExcelInput {
  filename: string;
  sheets: ExcelSheet[];
}

// Output from createExcel tool
export interface CreateExcelOutput {
  success: boolean;
  fileUrl?: string;
  filename?: string;
  error?: string;
  // Data for artifact rendering
  excelData?: ExcelData;
}

// Input for parseExcel tool
export interface ParseExcelInput {
  fileUrl: string;
}

// Sheet summary from parsing
export interface ParsedSheet {
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  preview: Record<string, unknown>[]; // First 10 rows
  formulas: string[];
  summary: string;
}

// Output from parseExcel tool
export interface ParseExcelOutput {
  success: boolean;
  filename?: string;
  sheets?: ParsedSheet[];
  error?: string;
}

// Edit operation types
export type EditOperationType =
  | "addColumn"
  | "addRow"
  | "updateCell"
  | "addFormula"
  | "addChart"
  | "deleteColumn"
  | "deleteRow"
  | "updateStyle";

// Edit operation
export interface EditOperation {
  type: EditOperationType;
  sheet?: string;
  // For addColumn
  column?: ExcelColumn;
  position?: number;
  // For addRow
  rowData?: Record<string, unknown>;
  rowIndex?: number;
  // For updateCell
  cell?: string;
  value?: unknown;
  // For addFormula
  formula?: ExcelFormula;
  // For addChart
  chart?: ExcelChart;
  // For deleteColumn/deleteRow
  columnKey?: string;
  // For updateStyle
  styles?: ExcelStyles;
}

// Input for editExcel tool
export interface EditExcelInput {
  documentId: string;
  operations: EditOperation[];
}

// Output from editExcel tool
export interface EditExcelOutput {
  success: boolean;
  fileUrl?: string;
  error?: string;
  excelData?: ExcelData;
}

// Cell data for rendering
export interface ExcelCellData {
  value: unknown;
  type: ColumnType;
  formula?: string;
  formatted?: string;
}

// Row data for rendering
export interface ExcelRowData {
  [key: string]: ExcelCellData;
}

// Complete Excel data for artifact rendering
export interface ExcelData {
  filename: string;
  sheets: {
    name: string;
    columns: ExcelColumn[];
    data?: Record<string, unknown>[]; // Raw data from generation
    rows?: ExcelRowData[]; // Processed row data for rendering
    charts?: ExcelChart[];
    styles?: ExcelStyles;
  }[];
  fileUrl?: string;
}

// Template metadata
export interface ExcelTemplate {
  id: string;
  name: string;
  description: string;
  category: "budget" | "business" | "marketing" | "hr" | "general";
  sheets: ExcelSheet[];
}
