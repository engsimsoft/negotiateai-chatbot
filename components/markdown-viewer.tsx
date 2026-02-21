"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * MarkdownViewer — общий компонент для рендеринга Markdown
 *
 * Используется в:
 * - artifacts/markdown/client.tsx (документы)
 * - components/file-viewer/renderers/markdown-renderer.tsx (файловый просмотрщик)
 *
 * Особенности:
 * - GFM (tables, strikethrough, autolinks)
 * - Prose стилизация с dark mode
 * - Мемоизация для производительности
 */
export const MarkdownViewer = memo(function MarkdownViewer({
  content,
  className = "",
}: MarkdownViewerProps) {
  return (
    <div
      className={`prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-base prose-li:text-base prose-code:text-sm prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted prose-pre:text-foreground prose-pre:p-4 prose-pre:overflow-x-auto prose-table:text-sm prose-th:bg-muted/50 prose-th:p-2 prose-td:p-2 prose-blockquote:border-l-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1 ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
