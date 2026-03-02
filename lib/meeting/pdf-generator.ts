// ТЗ-MR2 Этап 3: Markdown → PDF generator using pdfmake + remark AST
// Server-only: uses PdfPrinter with Roboto (Cyrillic support built-in)

import "server-only";

import path from "path";
// @ts-expect-error — pdfmake/js/Printer has no TS declarations
import PrinterModule from "pdfmake/js/Printer";
import type { TDocumentDefinitions, Content, ContentText, ContentColumns, ContentTable, ContentUnorderedList, ContentOrderedList, ContentStack } from "pdfmake/interfaces";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent, TableRow, TableCell } from "mdast";

// ============================================================================
// Font setup — Roboto from pdfmake (built-in Cyrillic support)
// ============================================================================

const FONTS_DIR = path.join(
  process.cwd(),
  "node_modules",
  "pdfmake",
  "fonts",
  "Roboto",
);

const fonts = {
  Roboto: {
    normal: path.join(FONTS_DIR, "Roboto-Regular.ttf"),
    bold: path.join(FONTS_DIR, "Roboto-Medium.ttf"),
    italics: path.join(FONTS_DIR, "Roboto-Italic.ttf"),
    bolditalics: path.join(FONTS_DIR, "Roboto-MediumItalic.ttf"),
  },
};

// pdfmake v0.3.x: default export from compiled JS
const PdfPrinter = (PrinterModule as { default?: unknown }).default ?? PrinterModule;
const printer = new (PdfPrinter as new (fonts: Record<string, Record<string, string>>) => {
  createPdfKitDocument: (docDefinition: TDocumentDefinitions) => Promise<NodeJS.ReadableStream & { end: () => void }>;
})(fonts);

// ============================================================================
// Transliteration utility (for filename)
// ============================================================================

const TRANSLIT_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function transliterate(text: string): string {
  return text
    .split("")
    .map((char) => {
      const lower = char.toLowerCase();
      if (TRANSLIT_MAP[lower] !== undefined) {
        return char === lower
          ? TRANSLIT_MAP[lower]
          : TRANSLIT_MAP[lower].charAt(0).toUpperCase() + TRANSLIT_MAP[lower].slice(1);
      }
      return char;
    })
    .join("")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

// ============================================================================
// Markdown → pdfmake content converter
// ============================================================================

/** Parse markdown to mdast AST */
function parseMarkdown(markdown: string): Root {
  const processor = unified().use(remarkParse).use(remarkGfm);
  return processor.parse(markdown) as Root;
}

/** Convert inline (phrasing) content nodes to pdfmake text array */
function convertInlineNodes(
  nodes: PhrasingContent[],
  parentStyle?: { bold?: boolean; italics?: boolean },
): ContentText[] {
  const result: ContentText[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case "text":
        result.push({
          text: node.value,
          ...(parentStyle?.bold && { bold: true }),
          ...(parentStyle?.italics && { italics: true }),
        });
        break;

      case "strong":
        result.push(
          ...convertInlineNodes(node.children, {
            ...parentStyle,
            bold: true,
          }),
        );
        break;

      case "emphasis":
        result.push(
          ...convertInlineNodes(node.children, {
            ...parentStyle,
            italics: true,
          }),
        );
        break;

      case "inlineCode":
        result.push({
          text: node.value,
          font: "Roboto",
          fontSize: 9,
          background: "#f0f0f0",
          ...(parentStyle?.bold && { bold: true }),
          ...(parentStyle?.italics && { italics: true }),
        });
        break;

      case "link":
        result.push(
          ...convertInlineNodes(node.children, parentStyle).map((t) => ({
            ...t,
            color: "#2563eb",
            decoration: "underline" as const,
            link: node.url,
          })),
        );
        break;

      case "break":
        result.push({ text: "\n" });
        break;

      default:
        // For unknown inline nodes, try to extract text
        if ("value" in node && typeof node.value === "string") {
          result.push({ text: node.value });
        }
        break;
    }
  }

  return result;
}

/** Convert a single block-level AST node to pdfmake content */
function convertBlockNode(node: RootContent): Content | Content[] | null {
  switch (node.type) {
    case "heading": {
      const level = node.depth;
      const sizes: Record<number, number> = { 1: 18, 2: 15, 3: 13, 4: 11 };
      return {
        text: convertInlineNodes(node.children),
        fontSize: sizes[level] ?? 11,
        bold: true,
        margin: [0, level <= 2 ? 14 : 8, 0, 4] as [number, number, number, number],
      } as ContentText;
    }

    case "paragraph": {
      return {
        text: convertInlineNodes(node.children),
        fontSize: 10,
        lineHeight: 1.4,
        margin: [0, 0, 0, 6] as [number, number, number, number],
      } as ContentText;
    }

    case "blockquote": {
      const innerContent: Content[] = [];
      for (const child of node.children) {
        const converted = convertBlockNode(child);
        if (converted) {
          if (Array.isArray(converted)) {
            innerContent.push(...converted);
          } else {
            innerContent.push(converted);
          }
        }
      }
      return {
        columns: [
          {
            width: 3,
            canvas: [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 3,
                h: 100, // will be auto-sized
                color: "#d1d5db",
              },
            ],
          },
          {
            width: "*",
            stack: innerContent,
            margin: [8, 0, 0, 0] as [number, number, number, number],
            color: "#6b7280",
            italics: true,
          },
        ],
        margin: [0, 4, 0, 8] as [number, number, number, number],
      } as ContentColumns;
    }

    case "list": {
      const items = node.children.map((item) => {
        const content: Content[] = [];
        for (const child of item.children) {
          const converted = convertBlockNode(child);
          if (converted) {
            if (Array.isArray(converted)) {
              content.push(...converted);
            } else {
              content.push(converted);
            }
          }
        }
        return content.length === 1 ? content[0] : { stack: content };
      });

      if (node.ordered) {
        return {
          ol: items,
          fontSize: 10,
          lineHeight: 1.4,
          margin: [0, 0, 0, 6] as [number, number, number, number],
        } as ContentOrderedList;
      }
      return {
        ul: items,
        fontSize: 10,
        lineHeight: 1.4,
        margin: [0, 0, 0, 6] as [number, number, number, number],
      } as ContentUnorderedList;
    }

    case "table": {
      const rows = node.children as TableRow[];
      if (rows.length === 0) return null;

      const tableBody = rows.map((row, rowIdx) => {
        return (row.children as TableCell[]).map((cell) => {
          // TableCell children are PhrasingContent[] in GFM mdast
          const text = convertInlineNodes(cell.children as PhrasingContent[]);
          return {
            text: text.length > 0 ? text : "",
            fontSize: 9,
            bold: rowIdx === 0,
            fillColor: rowIdx === 0 ? "#f3f4f6" : undefined,
            margin: [4, 3, 4, 3] as [number, number, number, number],
          };
        });
      });

      // Ensure all rows have the same number of columns
      const maxCols = Math.max(...tableBody.map((r) => r.length));
      const normalizedBody = tableBody.map((row) => {
        while (row.length < maxCols) {
          row.push({ text: "", fontSize: 9, bold: false, fillColor: undefined, margin: [4, 3, 4, 3] as [number, number, number, number] });
        }
        return row;
      });

      return {
        table: {
          headerRows: 1,
          widths: Array(maxCols).fill("*"),
          body: normalizedBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#d1d5db",
          vLineColor: () => "#d1d5db",
        },
        margin: [0, 4, 0, 8] as [number, number, number, number],
      } as ContentTable;
    }

    case "code": {
      return {
        text: node.value,
        fontSize: 9,
        font: "Roboto",
        background: "#f9fafb",
        margin: [8, 4, 8, 8] as [number, number, number, number],
        lineHeight: 1.3,
      } as ContentText;
    }

    case "thematicBreak": {
      return {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 480,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#d1d5db",
          },
        ],
        margin: [0, 8, 0, 8] as [number, number, number, number],
      };
    }

    default:
      return null;
  }
}

/** Convert full markdown AST to pdfmake content array */
function convertAstToContent(ast: Root): Content[] {
  const content: Content[] = [];

  for (const node of ast.children) {
    const converted = convertBlockNode(node);
    if (converted) {
      if (Array.isArray(converted)) {
        content.push(...converted);
      } else {
        content.push(converted);
      }
    }
  }

  return content;
}

// ============================================================================
// Public API
// ============================================================================

interface GeneratePdfOptions {
  title: string;
  summary: string;
  createdAt: Date;
}

/**
 * Generate a PDF buffer from meeting summary markdown.
 * Returns a Promise<Buffer> ready to be sent as Response body.
 */
export async function generateMeetingPdf(
  options: GeneratePdfOptions,
): Promise<Buffer> {
  const { title, summary, createdAt } = options;

  const dateStr = createdAt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Parse markdown to AST
  const ast = parseMarkdown(summary);
  const bodyContent = convertAstToContent(ast);

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],

    // Header: title + date
    header: {
      stack: [
        {
          text: title,
          fontSize: 14,
          bold: true,
          margin: [40, 20, 40, 0] as [number, number, number, number],
        },
        {
          text: dateStr,
          fontSize: 9,
          color: "#9ca3af",
          margin: [40, 2, 40, 0] as [number, number, number, number],
        },
      ],
    },

    // Footer: "Создано в Simply" on every page
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        {
          text: "Создано в Simply",
          fontSize: 8,
          color: "#9ca3af",
          alignment: "left" as const,
          margin: [40, 0, 0, 0] as [number, number, number, number],
        },
        {
          text: `${currentPage} / ${pageCount}`,
          fontSize: 8,
          color: "#9ca3af",
          alignment: "right" as const,
          margin: [0, 0, 40, 0] as [number, number, number, number],
        },
      ],
    }),

    content: bodyContent,

    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
      lineHeight: 1.4,
    },
  };

  // pdfmake v0.3.x: createPdfKitDocument returns Promise<PDFDocument>
  const pdfDoc = await printer.createPdfKitDocument(docDefinition);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}
