"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import {
  CopyIcon,
  DownloadIcon,
  CheckCircleFillIcon,
} from "@/components/icons";

type SharedDocument = {
  id: string;
  title: string;
  content: string | null;
  kind: string;
  createdAt: Date;
  sharedAt: Date | null;
};

type Props = {
  document: SharedDocument;
};

// PDF download function for markdown
async function downloadAsPDF(content: string, title: string) {
  try {
    const html2pdf = (await import("html2pdf.js")).default;

    const container = document.createElement("div");
    container.style.cssText = `
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
    `;

    // Simple markdown to HTML conversion for PDF
    let html = content
      .replace(/^### (.*$)/gm, '<h3 style="font-size: 16px; font-weight: 600; margin: 24px 0 12px;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="font-size: 18px; font-weight: 600; margin: 28px 0 14px;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="font-size: 22px; font-weight: 700; margin: 32px 0 16px;">$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px;">$1</code>')
      .replace(/^\- (.*)$/gm, '<li style="margin: 4px 0;">$1</li>')
      .replace(/^\d+\. (.*)$/gm, '<li style="margin: 4px 0;">$1</li>')
      .replace(/^> (.*)$/gm, '<blockquote style="border-left: 3px solid #d1d5db; padding-left: 16px; margin: 16px 0; color: #6b7280;">$1</blockquote>')
      .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
      .replace(/\n/g, '<br>');

    html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/g, (match) => {
      return `<ul style="margin: 12px 0; padding-left: 24px;">${match}</ul>`;
    });

    container.innerHTML = `<p style="margin: 12px 0;">${html}</p>`;
    document.body.appendChild(container);

    await html2pdf()
      .set({
        margin: 15,
        filename: `${title || "document"}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();

    document.body.removeChild(container);
    toast.success("PDF скачан!");
  } catch (error) {
    console.error("PDF generation error:", error);
    toast.error("Ошибка генерации PDF");
  }
}

export function SharedDocumentView({ document }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (document.content) {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadText = () => {
    if (document.content) {
      const blob = new Blob([document.content], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.title || "document"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadMarkdown = () => {
    if (document.content) {
      const blob = new Blob([document.content], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = `${document.title || "document"}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadPDF = () => {
    if (document.content) {
      downloadAsPDF(document.content, document.title || "document");
    }
  };

  // Support text and markdown
  if (document.kind !== "text" && document.kind !== "markdown") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">
          Этот тип документа пока не поддерживается для публичного просмотра.
        </p>
      </div>
    );
  }

  const isMarkdown = document.kind === "markdown";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h1 className="text-xl font-semibold truncate">{document.title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-accent transition-colors"
            title="Скопировать"
          >
            {copied ? (
              <>
                <CheckCircleFillIcon size={16} />
                <span>Скопировано!</span>
              </>
            ) : (
              <>
                <CopyIcon size={16} />
                <span>Копировать</span>
              </>
            )}
          </button>

          {isMarkdown ? (
            <>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-accent transition-colors"
                title="Скачать PDF"
              >
                <DownloadIcon size={16} />
                <span>PDF</span>
              </button>
              <button
                onClick={handleDownloadMarkdown}
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-accent transition-colors"
                title="Скачать Markdown"
              >
                <DownloadIcon size={16} />
                <span>.md</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleDownloadText}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-accent transition-colors"
              title="Скачать как .txt"
            >
              <DownloadIcon size={16} />
              <span>Скачать</span>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {isMarkdown ? (
          <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-base prose-li:text-base prose-code:text-sm prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:p-4 prose-table:text-sm prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {document.content || "Нет содержимого"}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">
            {document.content || "Нет содержимого"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-sm text-muted-foreground flex items-center justify-between">
        <span>Создано в Simply</span>
        <a
          href="https://negotiateai-chatbot-engsimsoft-gmailcoms-projects.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-foreground transition-colors"
        >
          simply.co
        </a>
      </div>
    </div>
  );
}
