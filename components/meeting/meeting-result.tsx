// ТЗ-MR Этап 4: Meeting result — markdown render + metadata + clickable timestamps

"use client";

import { useRef, useCallback, useMemo, useEffect, useState } from "react";
import {
  Clock,
  Users,
  FileText,
  RotateCcw,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  FileAudio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownViewer } from "@/components/markdown-viewer";

const LEVEL_LABELS: Record<string, string> = {
  compact: "Сводка",
  standard: "Протокол",
  detailed: "Детальный",
};

// Regex: matches [HH:MM:SS] or [MM:SS] patterns in text nodes
const TIMESTAMP_RE = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;

function parseTimestampToSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

interface MeetingResultProps {
  title: string;
  summary: string;
  durationSeconds: number;
  speakerCount: number;
  summaryLevel: string;
  createdAt?: string;
  /** Local audio URL (only available for current session recordings) */
  audioUrl?: string | null;
  onNewRecording: () => void;
  onDelete?: () => void;
  /** ТЗ-MR2: callback to open regenerate modal */
  onRegenerate?: () => void;
}

export function MeetingResult({
  title,
  summary,
  durationSeconds,
  speakerCount,
  summaryLevel,
  createdAt,
  audioUrl,
  onNewRecording,
  onDelete,
  onRegenerate,
}: MeetingResultProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Format duration as "X мин" or "X ч Y мин"
  const durationLabel = useMemo(() => {
    const mins = Math.round(durationSeconds / 60);
    if (mins < 60) return `${mins} мин`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} ч ${m} мин` : `${h} ч`;
  }, [durationSeconds]);

  // Format createdAt date
  const dateLabel = useMemo(() => {
    if (!createdAt) return null;
    return new Date(createdAt).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [createdAt]);

  // Post-render: wrap [HH:MM:SS] text in clickable spans (only when audio is available)
  useEffect(() => {
    if (!audioUrl || !contentRef.current) return;

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT,
    );

    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (TIMESTAMP_RE.test((node as Text).textContent ?? "")) {
        textNodes.push(node as Text);
      }
      // Reset lastIndex since we're reusing the regex
      TIMESTAMP_RE.lastIndex = 0;
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent ?? "";
      const fragment = document.createDocumentFragment();
      let lastIdx = 0;

      TIMESTAMP_RE.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TIMESTAMP_RE.exec(text)) !== null) {
        // Text before the match
        if (match.index > lastIdx) {
          fragment.appendChild(
            document.createTextNode(text.slice(lastIdx, match.index)),
          );
        }

        // Clickable timestamp span
        const span = document.createElement("span");
        span.textContent = match[0];
        span.className =
          "cursor-pointer text-primary hover:underline font-mono text-xs";
        span.dataset.timestamp = String(
          parseTimestampToSeconds(match[1]),
        );
        fragment.appendChild(span);

        lastIdx = match.index + match[0].length;
      }

      // Remaining text
      if (lastIdx < text.length) {
        fragment.appendChild(document.createTextNode(text.slice(lastIdx)));
      }

      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }, [audioUrl, summary]);

  // Event delegation for timestamp clicks
  const handleContentClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.dataset.timestamp && audioRef.current) {
        const seconds = Number.parseInt(target.dataset.timestamp, 10);
        if (!Number.isNaN(seconds)) {
          audioRef.current.currentTime = seconds;
          audioRef.current.play();
        }
      }
    },
    [],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore
    }
  }, [summary]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-serif text-lg font-semibold">{title}</h2>
          {dateLabel && (
            <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onNewRecording}
          className="shrink-0 gap-2"
        >
          <RotateCcw className="size-3.5" />
          Новая запись
        </Button>
      </div>

      {/* Metadata pills */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {durationLabel}
        </span>
        {speakerCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            <Users className="size-3" />
            {speakerCount} спикер(ов)
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <FileText className="size-3" />
          {LEVEL_LABELS[summaryLevel] ?? summaryLevel}
        </span>
      </div>

      {/* Audio player (if available) */}
      {audioUrl && (
        <div className="rounded-xl border bg-background p-4">
          <div className="mb-2 flex items-center gap-2">
            <FileAudio className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Аудиозапись (нажмите на тайм-код в тексте для перемотки)
            </span>
          </div>
          <audio ref={audioRef} src={audioUrl} controls className="w-full" />
        </div>
      )}

      {/* Document content */}
      <div
        ref={contentRef}
        className="rounded-xl border bg-background p-5"
        onClick={handleContentClick}
      >
        <MarkdownViewer content={summary} className="text-sm" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Скопировано" : "Копировать"}
        </Button>
        {onRegenerate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRegenerate}
            className="gap-2"
          >
            <RefreshCw className="size-3.5" />
            Создать другой отчёт
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            Удалить
          </Button>
        )}
      </div>
    </div>
  );
}
