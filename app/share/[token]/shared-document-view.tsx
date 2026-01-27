"use client";

import { useState } from "react";
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

export function SharedDocumentView({ document }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (document.content) {
      await navigator.clipboard.writeText(document.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
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

  // Currently only text is supported, presentation types will be added later
  if (document.kind !== "text") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">
          This document type is not supported for public viewing yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h1 className="text-xl font-semibold truncate">{document.title}</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-accent transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <>
                <CheckCircleFillIcon size={16} />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon size={16} />
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border hover:bg-accent transition-colors"
            title="Download as .txt"
          >
            <DownloadIcon size={16} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">
          {document.content || "No content"}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t text-sm text-muted-foreground">
        Shared document
      </div>
    </div>
  );
}
