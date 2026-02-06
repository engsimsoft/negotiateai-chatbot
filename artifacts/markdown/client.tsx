"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { DiffView } from "@/components/diffview";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { MarkdownViewer } from "@/components/markdown-viewer";
import { SparklesIcon } from "@/components/icons";
import {
  ClockRewind,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  PencilEditIcon,
  RedoIcon,
  ShareIcon,
  UndoIcon,
} from "@/components/icons";

type MarkdownArtifactMetadata = {
  isEditMode: boolean;
};

// Markdown Editor component - simple textarea
const MarkdownEditor = memo(function MarkdownEditor({
  content,
  onSaveContent,
  isCurrentVersion,
}: {
  content: string;
  onSaveContent: (content: string, debounce: boolean) => void;
  isCurrentVersion: boolean;
}) {
  return (
    <textarea
      className="w-full h-full min-h-[500px] font-mono text-sm bg-background border-0 outline-none resize-none p-0"
      value={content}
      onChange={(e) => {
        if (isCurrentVersion) {
          onSaveContent(e.target.value, true);
        }
      }}
      disabled={!isCurrentVersion}
      placeholder="Markdown content..."
    />
  );
});

// PDF download function using html2pdf.js
async function downloadAsPDF(content: string, title: string) {
  try {
    // Dynamically import html2pdf.js (client-side only)
    const html2pdf = (await import("html2pdf.js")).default;

    // Create a temporary container with rendered markdown
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
      // Headers
      .replace(/^### (.*$)/gm, '<h3 style="font-size: 16px; font-weight: 600; margin: 24px 0 12px;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="font-size: 18px; font-weight: 600; margin: 28px 0 14px;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="font-size: 22px; font-weight: 700; margin: 32px 0 16px;">$1</h1>')
      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-size: 13px;">$1</code>')
      // Lists
      .replace(/^\- (.*)$/gm, '<li style="margin: 4px 0;">$1</li>')
      .replace(/^\d+\. (.*)$/gm, '<li style="margin: 4px 0;">$1</li>')
      // Blockquotes
      .replace(/^> (.*)$/gm, '<blockquote style="border-left: 3px solid #d1d5db; padding-left: 16px; margin: 16px 0; color: #6b7280;">$1</blockquote>')
      // Paragraphs
      .replace(/\n\n/g, '</p><p style="margin: 12px 0;">')
      .replace(/\n/g, '<br>');

    // Wrap lists
    html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/g, (match) => {
      return `<ul style="margin: 12px 0; padding-left: 24px;">${match}</ul>`;
    });

    container.innerHTML = `<p style="margin: 12px 0;">${html}</p>`;
    document.body.appendChild(container);

    // Generate PDF
    await html2pdf()
      .set({
        margin: 15,
        filename: `${title || "document"}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();

    // Cleanup
    document.body.removeChild(container);
    toast.success("PDF скачан!");
  } catch (error) {
    console.error("PDF generation error:", error);
    toast.error("Ошибка генерации PDF");
  }
}

// Download as .md file
function downloadAsMarkdown(content: string, title: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title || "document"}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success("Markdown скачан!");
}

export const markdownArtifact = new Artifact<"markdown", MarkdownArtifactMetadata>({
  kind: "markdown",
  description: "Markdown documents with formatting (headers, lists, tables, code).",
  initialize: ({ setMetadata }) => {
    setMetadata({ isEditMode: false });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-markdownDelta") {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + streamPart.data,
          // Open artifact immediately when streaming starts (shows Code Rain first)
          isVisible: true,
          status: "streaming",
        };
      });
    }
  },
  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    if (isLoading) {
      return <DocumentSkeleton artifactKind="markdown" />;
    }

    if (mode === "diff") {
      const oldContent = getDocumentContentById(currentVersionIndex - 1);
      const newContent = getDocumentContentById(currentVersionIndex);
      return <DiffView newContent={newContent} oldContent={oldContent} />;
    }

    const isEditMode = metadata?.isEditMode ?? false;
    const isStreaming = status === "streaming";

    // Show Code Rain animation while content is being generated (first ~200 chars)
    if (isStreaming && (!content || content.length < 200)) {
      return <DocumentSkeleton artifactKind="markdown" />;
    }

    return (
      <div className="relative flex flex-col w-full h-full px-4 py-8 md:px-12">
        {isEditMode ? (
          <MarkdownEditor
            content={content}
            onSaveContent={onSaveContent}
            isCurrentVersion={isCurrentVersion}
          />
        ) : (
          <MarkdownViewer content={content} />
        )}

        {/* Streaming indicator */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="sticky bottom-4 left-0 right-0 flex justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/20 shadow-lg">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <SparklesIcon size={16} />
              </motion.div>
              <span className="text-sm font-medium text-primary">
                Генерация документа...
              </span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                    className="size-1.5 rounded-full bg-primary"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  },
  actions: [
    // Switch to Edit mode (shown when in view mode)
    {
      icon: <PencilEditIcon size={18} />,
      description: "Редактировать",
      onClick: ({ setMetadata }) => {
        setMetadata({ isEditMode: true });
      },
      isHidden: ({ metadata }) => metadata?.isEditMode === true,
    },
    // Switch to View mode (shown when in edit mode)
    {
      icon: <EyeIcon size={18} />,
      description: "Просмотр",
      onClick: ({ setMetadata }) => {
        setMetadata({ isEditMode: false });
      },
      isHidden: ({ metadata }) => metadata?.isEditMode !== true,
    },
    {
      icon: <ClockRewind size={18} />,
      description: "Просмотр изменений",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("toggle");
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <UndoIcon size={18} />,
      description: "Предыдущая версия",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "Следующая версия",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Копировать",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Скопировано!");
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "Скачать PDF",
      onClick: ({ content, title }) => {
        downloadAsPDF(content, title);
      },
    },
    {
      icon: <FileTextIcon size={18} />,
      description: "Скачать .md",
      onClick: ({ content, title }) => {
        downloadAsMarkdown(content, title);
      },
    },
    {
      icon: <ShareIcon size={18} />,
      description: "Поделиться",
      onClick: ({ openShareModal }) => {
        openShareModal();
      },
    },
  ],
  toolbar: [],
});
