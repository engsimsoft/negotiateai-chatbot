"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { ArrowUp, Download, ExternalLink, FileText, Loader2 } from "lucide-react";

import type { ChatMessage } from "@/lib/types";
import { fetcher, fetchWithErrorHandlers, generateUUID } from "@/lib/utils";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { labelForAutoType } from "./filters";

interface DocumentSplitViewProps {
  chatId: string;
  documentId: string;
  filename: string;
  mimeType: string;
  size: number;
  autoType: string | null;
  autoTags: string[] | null;
  autoDescription: string | null;
  autoSummary: string | null;
  createdAt: string;
}

const QUICK_PROMPTS = [
  "О чём этот документ?",
  "Ключевые тезисы списком",
  "Сроки и даты упомянутые в документе",
  "Главные выводы",
];

function isBrowserPreviewable(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType.startsWith("image/")
  );
}

interface DocumentDetailResponse {
  id: string;
  autoType: string | null;
  autoTags: string[] | null;
  autoDescription: string | null;
  autoSummary: string | null;
}

export function DocumentSplitView({
  chatId,
  documentId,
  filename,
  mimeType,
  size,
  autoType: initialAutoType,
  autoTags: initialAutoTags,
  autoDescription: initialAutoDescription,
  autoSummary: initialAutoSummary,
  createdAt,
}: DocumentSplitViewProps) {
  const [input, setInput] = useState("");
  const contentUrl = `/api/library/documents/${documentId}/content`;

  // Polling autoSummary: генерация fire-and-forget после upload, страница же
  // SSR-снимок. Если на момент захода обзор ещё не готов — поллим, пока он
  // не появится. Останавливаем как только autoSummary !== null.
  const { data: latest } = useSWR<DocumentDetailResponse>(
    `/api/library/documents/${documentId}`,
    fetcher,
    {
      fallbackData: {
        id: documentId,
        autoType: initialAutoType,
        autoTags: initialAutoTags,
        autoDescription: initialAutoDescription,
        autoSummary: initialAutoSummary,
      },
      refreshInterval: (data) => (data?.autoSummary ? 0 : 5000),
      revalidateOnFocus: true,
    },
  );

  const autoType = latest?.autoType ?? initialAutoType;
  const autoTags = latest?.autoTags ?? initialAutoTags;
  const autoDescription = latest?.autoDescription ?? initialAutoDescription;
  const autoSummary = latest?.autoSummary ?? initialAutoSummary;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: fetchWithErrorHandlers,
        prepareSendMessagesRequest(request) {
          return {
            body: {
              id: chatId,
              message: request.messages.at(-1),
              chatMode: "library-document",
              selectedVisibilityType: "private",
              lockedDocumentId: documentId,
            },
          };
        },
      }),
    [chatId, documentId],
  );

  const { messages, sendMessage, status } = useChat<ChatMessage>({
    id: chatId,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport,
    onError: (error) => {
      toast({
        type: "error",
        description: error.message || "Ошибка при отправке сообщения",
      });
    },
  });

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage({
      role: "user" as const,
      parts: [{ type: "text", text: trimmed }],
    });
    setInput("");
  };

  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto border-b bg-background lg:border-r lg:border-b-0">
        <OverviewCard
          filename={filename}
          mimeType={mimeType}
          size={size}
          autoType={autoType}
          autoTags={autoTags}
          autoDescription={autoDescription}
          autoSummary={autoSummary}
          createdAt={createdAt}
          contentUrl={contentUrl}
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col bg-background">
        <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-6">
          {messages.length === 0 ? (
            <QuickStart onPick={submit} />
          ) : (
            <MessageList messages={messages} />
          )}
        </div>

        <div className="border-t bg-background p-3 lg:p-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!isStreaming) submit(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={`Задай вопрос по документу «${filename}»…`}
              rows={2}
              className="max-h-40 resize-none"
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  if (!isStreaming) submit(input);
                }
              }}
              disabled={isStreaming}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isStreaming || input.trim().length === 0}
              aria-label="Отправить"
            >
              {isStreaming ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}

interface OverviewCardProps {
  filename: string;
  mimeType: string;
  size: number;
  autoType: string | null;
  autoTags: string[] | null;
  autoDescription: string | null;
  autoSummary: string | null;
  createdAt: string;
  contentUrl: string;
}

function OverviewCard({
  filename,
  mimeType,
  size,
  autoType,
  autoTags,
  autoDescription,
  autoSummary,
  createdAt,
  contentUrl,
}: OverviewCardProps) {
  const ext = getFileExtension(filename, mimeType);
  const sizeLabel = formatFileSize(size);
  const dateLabel = formatDate(createdAt);
  const typeLabel = autoType ? labelForAutoType(autoType) : null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-8 lg:py-10">
      <header className="flex items-start gap-4">
        <div className="flex h-14 w-11 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold uppercase text-muted-foreground">
          {ext}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-xl font-semibold leading-tight wrap-break-word">
            {filename}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {[typeLabel, sizeLabel, dateLabel].filter(Boolean).join(" · ")}
          </p>
        </div>
      </header>

      {autoSummary ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            О документе
          </h3>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {autoSummary}
          </p>
          {autoDescription && (
            <p className="mt-3 text-xs italic text-muted-foreground">
              {autoDescription}
            </p>
          )}
        </section>
      ) : autoDescription ? (
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            О документе
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal normal-case text-muted-foreground">
              готовится развёрнутый обзор…
            </span>
          </h3>
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {autoDescription}
          </p>
        </section>
      ) : (
        <section className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          <p>
            Обзор документа ещё готовится. Спросите у модели справа «О чём этот
            документ?» — она ответит по содержимому прямо сейчас.
          </p>
        </section>
      )}

      {autoTags && autoTags.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Теги
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {autoTags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-wrap gap-2 pt-2">
        {isBrowserPreviewable(mimeType) && (
          <Button asChild variant="outline" size="sm">
            <a
              href={contentUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FileText className="mr-2 size-4" />
              Открыть полный текст
              <ExternalLink className="ml-2 size-3 opacity-60" />
            </a>
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <a href={contentUrl} download={filename}>
            <Download className="mr-2 size-4" />
            Скачать
          </a>
        </Button>
      </section>
    </div>
  );
}

function QuickStart({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 py-10">
      <p className="text-sm text-muted-foreground">
        Задай любой вопрос по этому документу или выбери один из стартовых:
      </p>
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            onClick={() => onPick(prompt)}
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  );
}

function MessageList({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    ?.filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n") ?? "";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {text || (isUser ? "" : "…")}
      </div>
    </div>
  );
}

function getFileExtension(filename: string, mimeType: string): string {
  const byName = filename.split(".").pop()?.toLowerCase();
  if (byName && byName.length <= 5) return byName.toUpperCase();
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "XLS";
  if (mimeType.includes("wordprocessing")) return "DOC";
  if (mimeType.includes("presentation")) return "PPT";
  if (mimeType.startsWith("image/")) return "IMG";
  if (mimeType.startsWith("text/")) return "TXT";
  return "FILE";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? `${Math.round(mb)} МБ` : `${mb.toFixed(1)} МБ`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
