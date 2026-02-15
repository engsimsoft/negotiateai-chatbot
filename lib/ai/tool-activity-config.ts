/**
 * ТЗ-07: Tool Activity UX
 *
 * Config mapping toolName → UI representation for ToolActivityIndicator.
 * Only tools WITHOUT their own renderer are listed here.
 * Tools with custom renderers (getWeather, createDocument, etc.) are handled
 * earlier in message.tsx and never reach the catch-all.
 */

import type { LucideIcon } from "lucide-react";
import { FolderOpen, Search, Table2 } from "lucide-react";

export interface ToolActivityConfig {
  icon: LucideIcon;
  activeLabel: string;
  doneLabel: string;
  argsFormatter?: (args: any) => string | null;
  resultFormatter?: (result: any) => string | null;
  /** Extract numeric count from a single result for aggregation across parallel calls */
  resultCounter?: (result: any) => number;
}

export const TOOL_ACTIVITY_CONFIG: Record<string, ToolActivityConfig> = {
  webSearch: {
    icon: Search,
    activeLabel: "Поиск в интернете",
    doneLabel: "Поиск завершён",
    argsFormatter: (args) => args?.query || null,
    resultFormatter: (result) => {
      if (result?.error) return null;
      const count = result?.count ?? result?.results?.length;
      if (typeof count === "number") return `${count} результатов`;
      return null;
    },
    resultCounter: (result) => {
      if (!result || result.error) return 0;
      return result.count ?? result.results?.length ?? 0;
    },
  },

  parseExcel: {
    icon: Table2,
    activeLabel: "Анализирую таблицу",
    doneLabel: "Таблица проанализирована",
    argsFormatter: (args) => {
      if (!args?.fileUrl) return null;
      return args.fileUrl.split("/").pop()?.split("?")[0] || null;
    },
  },

  readProjectFile: {
    icon: FolderOpen,
    activeLabel: "Читаю файл проекта",
    doneLabel: "Файл прочитан",
    argsFormatter: (args) => args?.fileName || null,
  },
};
