/**
 * Excel Tool - Main exports
 *
 * Tools for creating, parsing, and editing Excel files
 */

// Tools
export { createExcel } from "./create-excel";
export { parseExcel } from "./parse-excel";
export { editExcel, applyOperations, saveWorkbook } from "./edit-excel";

// Types
export type {
  ColumnType,
  ChartType,
  ThemeId,
  ExcelColumn,
  ExcelFormula,
  ExcelChart,
  ExcelStyles,
  ExcelSheet,
  CreateExcelInput,
  CreateExcelOutput,
  ParseExcelInput,
  ParseExcelOutput,
  ParsedSheet,
  EditExcelInput,
  EditExcelOutput,
  EditOperation,
  EditOperationType,
  ExcelData,
  ExcelCellData,
  ExcelRowData,
  ExcelTemplate,
} from "./types";

// Styles
export {
  themes,
  defaultTheme,
  getThemeColors,
  getHeaderStyle,
  getAlternateRowStyle,
  getTotalRowStyle,
  getNegativeStyle,
  numberFormats,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
} from "./styles";

// Utils
export {
  formatValue,
  convertToRowData,
  getColumnLetter,
  parseCellReference,
  getCellReference,
  isTotalRow,
  calculateColumnWidth,
  generateSumFormula,
  generateAverageFormula,
  generatePercentFormula,
  sanitizeFilename,
  parseRange,
  detectColumnType,
} from "./utils";
