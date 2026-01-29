/**
 * Excel color themes and styles
 */

import type { ThemeId } from "./types";

// Theme color definition
export interface ThemeColors {
  primary: string;
  primaryText: string;
  headerBg: string;
  headerText: string;
  alternateRow: string;
  border: string;
  totalRow: string;
  negative: string;
}

// Color themes
export const themes: Record<ThemeId, ThemeColors> = {
  "corporate-blue": {
    primary: "#4472C4",
    primaryText: "#FFFFFF",
    headerBg: "#4472C4",
    headerText: "#FFFFFF",
    alternateRow: "#D6DCE5",
    border: "#8FAADC",
    totalRow: "#2F5496",
    negative: "#FF0000",
  },
  "forest-green": {
    primary: "#70AD47",
    primaryText: "#FFFFFF",
    headerBg: "#70AD47",
    headerText: "#FFFFFF",
    alternateRow: "#E2EFDA",
    border: "#A9D18E",
    totalRow: "#548235",
    negative: "#FF0000",
  },
  "warm-orange": {
    primary: "#ED7D31",
    primaryText: "#FFFFFF",
    headerBg: "#ED7D31",
    headerText: "#FFFFFF",
    alternateRow: "#FCE4D6",
    border: "#F4B183",
    totalRow: "#C65911",
    negative: "#FF0000",
  },
  "professional-gray": {
    primary: "#7F7F7F",
    primaryText: "#FFFFFF",
    headerBg: "#7F7F7F",
    headerText: "#FFFFFF",
    alternateRow: "#E7E6E6",
    border: "#BFBFBF",
    totalRow: "#595959",
    negative: "#FF0000",
  },
  "modern-teal": {
    primary: "#00B0F0",
    primaryText: "#FFFFFF",
    headerBg: "#00B0F0",
    headerText: "#FFFFFF",
    alternateRow: "#DAEEF3",
    border: "#9DC3E6",
    totalRow: "#0070C0",
    negative: "#FF0000",
  },
};

// Default theme
export const defaultTheme: ThemeId = "corporate-blue";

// Get theme colors
export function getThemeColors(themeId?: ThemeId): ThemeColors {
  return themes[themeId || defaultTheme];
}

// Russian number formatting
export function formatNumber(value: number): string {
  return value.toLocaleString("ru-RU");
}

// Russian currency formatting (rubles)
export function formatCurrency(value: number): string {
  return `${value.toLocaleString("ru-RU")} \u20BD`;
}

// Russian percent formatting
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

// Russian date formatting (DD.MM.YYYY)
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// ExcelJS style object for header
export function getHeaderStyle(themeId?: ThemeId) {
  const colors = getThemeColors(themeId);
  return {
    fill: {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: colors.headerBg.replace("#", "FF") },
    },
    font: {
      bold: true,
      color: { argb: colors.headerText.replace("#", "FF") },
    },
    alignment: {
      horizontal: "center" as const,
      vertical: "middle" as const,
    },
    border: {
      top: { style: "thin" as const, color: { argb: colors.border.replace("#", "FF") } },
      left: { style: "thin" as const, color: { argb: colors.border.replace("#", "FF") } },
      bottom: { style: "thin" as const, color: { argb: colors.border.replace("#", "FF") } },
      right: { style: "thin" as const, color: { argb: colors.border.replace("#", "FF") } },
    },
  };
}

// ExcelJS style object for alternating row
export function getAlternateRowStyle(themeId?: ThemeId) {
  const colors = getThemeColors(themeId);
  return {
    fill: {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: colors.alternateRow.replace("#", "FF") },
    },
  };
}

// ExcelJS style object for total row
export function getTotalRowStyle(themeId?: ThemeId) {
  const colors = getThemeColors(themeId);
  return {
    fill: {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: colors.totalRow.replace("#", "FF") },
    },
    font: {
      bold: true,
      color: { argb: "FFFFFFFF" },
    },
    border: {
      top: { style: "medium" as const, color: { argb: colors.border.replace("#", "FF") } },
      left: { style: "thin" as const, color: { argb: colors.border.replace("#", "FF") } },
      bottom: { style: "medium" as const, color: { argb: colors.border.replace("#", "FF") } },
      right: { style: "thin" as const, color: { argb: colors.border.replace("#", "FF") } },
    },
  };
}

// ExcelJS style for negative numbers
export function getNegativeStyle() {
  return {
    font: {
      color: { argb: "FFFF0000" },
    },
  };
}

// Number formats for ExcelJS
export const numberFormats = {
  number: '#,##0',
  currency: '#,##0 "₽"',
  percent: '0%',
  date: 'DD.MM.YYYY',
};
