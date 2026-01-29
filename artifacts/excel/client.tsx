"use client";

import { memo, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { CopyIcon, DownloadIcon } from "@/components/icons";
import type { ExcelData, ExcelChart, ThemeId } from "@/lib/ai/tools/excel/types";
import { themes, formatCurrency, formatPercent, formatNumber } from "@/lib/ai/tools/excel/styles";

type ExcelArtifactMetadata = {
  activeSheet: number;
  excelData: ExcelData | null;
  fileUrl: string | null;
};

// Theme colors for charts
const CHART_COLORS = [
  "#4472C4", "#ED7D31", "#70AD47", "#FFC000", "#5B9BD5",
  "#A5A5A5", "#7030A0", "#FF5050", "#00B050", "#0070C0",
];

// Excel Table component
const ExcelTable = memo(function ExcelTable({
  sheet,
  themeId,
}: {
  sheet: ExcelData["sheets"][0];
  themeId?: ThemeId;
}) {
  const theme = themes[themeId || "corporate-blue"];

  // Format cell value based on type
  const formatCell = (value: unknown, type?: string): string => {
    if (value === null || value === undefined) return "";
    if (type === "currency") return formatCurrency(Number(value));
    if (type === "percent") return formatPercent(Number(value));
    if (type === "number") return formatNumber(Number(value));
    return String(value);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {sheet.columns.map((col, idx) => (
              <th
                key={col.key}
                className="px-3 py-2 text-left font-semibold border"
                style={{
                  backgroundColor: theme.headerBg,
                  color: theme.headerText,
                  borderColor: theme.border,
                  minWidth: col.width ? `${col.width * 8}px` : "auto",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(sheet.data || []).map((row, rowIdx) => {
            // Check if this is a total row
            const rowData = row as Record<string, unknown>;
            const firstCol = sheet.columns[0]?.key;
            const firstValue = String(rowData[firstCol] || "").toLowerCase();
            const isTotalRow =
              firstValue.includes("итого") ||
              firstValue.includes("всего") ||
              firstValue.includes("total");

            return (
              <tr
                key={rowIdx}
                style={{
                  backgroundColor: isTotalRow
                    ? theme.totalRow
                    : rowIdx % 2 === 1
                    ? theme.alternateRow
                    : "transparent",
                }}
              >
                {sheet.columns.map((col) => {
                  const value = rowData[col.key];
                  const isNegative =
                    typeof value === "number" && value < 0;

                  return (
                    <td
                      key={col.key}
                      className="px-3 py-2 border"
                      style={{
                        borderColor: theme.border,
                        color: isTotalRow
                          ? "#FFFFFF"
                          : isNegative
                          ? theme.negative
                          : "inherit",
                        fontWeight: isTotalRow ? "bold" : "normal",
                        textAlign:
                          col.type && col.type !== "text" ? "right" : "left",
                      }}
                    >
                      {formatCell(value, col.type)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

// Excel Chart component
const ExcelChartView = memo(function ExcelChartView({
  chart,
  data,
  columns,
}: {
  chart: ExcelChart;
  data: Record<string, unknown>[];
  columns: ExcelData["sheets"][0]["columns"];
}) {
  // Prepare chart data
  const chartData = useMemo(() => {
    // Simple: use first column as labels, second as values
    if (columns.length < 2) return [];

    const labelKey = columns[0].key;
    const valueKey = columns[1].key;

    return data.slice(0, -1).map((row) => ({
      name: String(row[labelKey] || ""),
      value: Number(row[valueKey]) || 0,
    }));
  }, [data, columns]);

  if (chartData.length === 0) return null;

  const renderChart = () => {
    switch (chart.type) {
      case "pie":
      case "doughnut":
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={chart.type === "doughnut" ? 60 : 0}
              outerRadius={80}
              label={({ name, percent }) =>
                `${name}: ${((percent || 0) * 100).toFixed(0)}%`
              }
            >
              {chartData.map((_, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        );

      case "line":
      case "area":
        return (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CHART_COLORS[0]}
              fill={chart.type === "area" ? CHART_COLORS[0] : undefined}
            />
          </LineChart>
        );

      case "bar":
        return (
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="name" type="category" width={100} />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={CHART_COLORS[0]} />
          </BarChart>
        );

      case "column":
      default:
        return (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill={CHART_COLORS[0]} />
          </BarChart>
        );
    }
  };

  return (
    <div className="mt-4 p-4 bg-muted/30 rounded-lg">
      <h4 className="text-sm font-medium mb-2">{chart.title}</h4>
      <ResponsiveContainer width="100%" height={250}>
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
});

// Sheet tabs component
const SheetTabs = memo(function SheetTabs({
  sheets,
  activeSheet,
  onSelectSheet,
}: {
  sheets: ExcelData["sheets"];
  activeSheet: number;
  onSelectSheet: (index: number) => void;
}) {
  if (sheets.length <= 1) return null;

  return (
    <div className="flex gap-1 border-b mb-4">
      {sheets.map((sheet, idx) => (
        <button
          key={sheet.name}
          className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
            idx === activeSheet
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
          onClick={() => onSelectSheet(idx)}
        >
          {sheet.name}
        </button>
      ))}
    </div>
  );
});

// PDF download function
async function downloadAsPDF(excelData: ExcelData, title: string) {
  try {
    const html2pdf = (await import("html2pdf.js")).default;

    const container = document.createElement("div");
    container.style.cssText = `
      padding: 40px;
      max-width: 1000px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
    `;

    // Generate HTML table
    let html = `<h1 style="font-size: 18px; margin-bottom: 20px;">${title}</h1>`;

    for (const sheet of excelData.sheets) {
      html += `<h2 style="font-size: 14px; margin: 20px 0 10px;">${sheet.name}</h2>`;
      html += '<table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">';

      // Header
      html += "<thead><tr>";
      for (const col of sheet.columns) {
        html += `<th style="border: 1px solid #ddd; padding: 8px; background: #4472C4; color: white; text-align: left;">${col.header}</th>`;
      }
      html += "</tr></thead>";

      // Body
      html += "<tbody>";
      for (const row of sheet.data || []) {
        html += "<tr>";
        for (const col of sheet.columns) {
          const value = row[col.key];
          html += `<td style="border: 1px solid #ddd; padding: 8px;">${value ?? ""}</td>`;
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
    }

    container.innerHTML = html;
    document.body.appendChild(container);

    await html2pdf()
      .set({
        margin: 10,
        filename: `${title.replace(/[^a-zA-Z0-9а-яА-Я]/g, "_")}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
      })
      .from(container)
      .save();

    document.body.removeChild(container);
    toast.success("PDF скачан");
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error("Ошибка экспорта PDF");
  }
}

// Main Excel Artifact
export const excelArtifact = new Artifact<"excel", ExcelArtifactMetadata>({
  kind: "excel",
  description: "Excel spreadsheets with tables, formulas, and charts",

  initialize: ({ setMetadata }) => {
    setMetadata({
      activeSheet: 0,
      excelData: null,
      fileUrl: null,
    });
  },

  onStreamPart: ({ streamPart, setMetadata, setArtifact }) => {
    if (streamPart.type === "data-excelDelta") {
      const data = streamPart.data as {
        excelData?: string;
        fileUrl?: string;
        isComplete?: boolean;
      };

      if (data.excelData) {
        try {
          const excelDataStr = data.excelData;
          const excelData = JSON.parse(excelDataStr) as ExcelData;
          setMetadata((prev) => ({
            ...prev,
            excelData,
            fileUrl: data.fileUrl || prev.fileUrl,
          }));

          setArtifact((prev) => ({
            ...prev,
            content: excelDataStr,
            isVisible: true,
            status: data.isComplete ? "idle" : "streaming",
          }));
        } catch (e) {
          console.error("Failed to parse Excel data:", e);
        }
      }
    }
  },

  content: ({ content, metadata, setMetadata, isCurrentVersion, status }) => {
    // Parse content if metadata not set
    const excelData = useMemo(() => {
      if (metadata?.excelData) return metadata.excelData;
      if (!content) return null;
      try {
        return JSON.parse(content) as ExcelData;
      } catch {
        return null;
      }
    }, [content, metadata?.excelData]);

    if (status === "streaming" && !excelData) {
      return <DocumentSkeleton artifactKind="excel" />;
    }

    if (!excelData) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          Нет данных для отображения
        </div>
      );
    }

    const activeSheet = excelData.sheets[metadata?.activeSheet ?? 0] || excelData.sheets[0];

    return (
      <div className="flex flex-col w-full h-full p-4 overflow-auto">
        <SheetTabs
          sheets={excelData.sheets}
          activeSheet={metadata?.activeSheet ?? 0}
          onSelectSheet={(idx) => setMetadata((prev) => ({ ...prev, activeSheet: idx }))}
        />

        <ExcelTable
          sheet={activeSheet}
          themeId={activeSheet.styles?.theme as ThemeId}
        />

        {activeSheet.charts?.map((chart, idx) => (
          <ExcelChartView
            key={idx}
            chart={chart}
            data={activeSheet.data || []}
            columns={activeSheet.columns}
          />
        ))}
      </div>
    );
  },

  actions: [
    {
      icon: <CopyIcon size={18} />,
      description: "Копировать как CSV",
      onClick: ({ content }) => {
        try {
          const data = JSON.parse(content) as ExcelData;
          const sheet = data.sheets[0];
          if (!sheet) return;

          // Generate CSV
          const headers = sheet.columns.map((c) => c.header).join(",");
          const rows = (sheet.data || [])
            .map((row) =>
              sheet.columns.map((c) => String(row[c.key] ?? "")).join(",")
            )
            .join("\n");

          navigator.clipboard.writeText(`${headers}\n${rows}`);
          toast.success("CSV скопирован в буфер");
        } catch {
          toast.error("Ошибка копирования");
        }
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Скачать XLSX",
      onClick: ({ content, metadata }) => {
        // Try metadata first (from streaming), then parse content (from DB)
        let fileUrl = (metadata?.excelData as ExcelData | null)?.fileUrl;
        let filename = (metadata?.excelData as ExcelData | null)?.filename;

        if (!fileUrl && content) {
          try {
            const parsed = JSON.parse(content) as ExcelData;
            fileUrl = parsed.fileUrl;
            filename = parsed.filename;
          } catch {
            // ignore parse error
          }
        }

        if (fileUrl) {
          const a = document.createElement("a");
          a.href = fileUrl;
          a.download = filename || "document.xlsx";
          a.click();
          toast.success("XLSX скачан");
        } else {
          toast.error("Файл недоступен");
        }
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Скачать PDF",
      onClick: async ({ content, title }) => {
        try {
          const data = JSON.parse(content) as ExcelData;
          await downloadAsPDF(data, title);
        } catch {
          toast.error("Ошибка экспорта PDF");
        }
      },
    },
  ],

  toolbar: [],
});
