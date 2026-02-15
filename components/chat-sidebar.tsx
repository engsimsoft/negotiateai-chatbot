"use client";

/**
 * ТЗ-08: Chat Sidebar — панель материалов чата
 *
 * Push-drawer справа (паттерн manager-drawer):
 * - Секция "Артефакты": документы, созданные AI (createDocument/updateDocument)
 * - Секция "Вложения": файлы, прикреплённые пользователем
 * - Empty state когда списки пусты
 * - Клик по элементу → scroll к сообщению + highlight (навигация по чату)
 * - Кнопка скачивания на каждом элементе
 */

import { type MouseEvent, useCallback, useMemo } from "react";
import {
  X,
  FileText,
  Image,
  Table,
  Presentation,
  Paperclip,
  FileIcon,
  Inbox,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtifactKind } from "@/components/artifact";
import type { ChatMessage } from "@/lib/types";

// --- Types ---

interface SidebarArtifact {
  id: string;
  title: string;
  kind: ArtifactKind;
  messageId: string;
}

interface SidebarAttachment {
  name: string;
  url: string;
  contentType: string;
  messageId: string;
}

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  messages: ChatMessage[];
}

// --- Helpers ---

function getArtifactIcon(kind: ArtifactKind) {
  switch (kind) {
    case "markdown":
    case "text":
      return <FileText className="size-4 text-muted-foreground" />;
    case "image":
      return <Image className="size-4 text-muted-foreground" />;
    case "excel":
      return <Table className="size-4 text-muted-foreground" />;
    case "presentation-reveal":
    case "presentation-pptx":
      return <Presentation className="size-4 text-muted-foreground" />;
    default:
      return <FileText className="size-4 text-muted-foreground" />;
  }
}

function getArtifactFormatLabel(kind: ArtifactKind): string {
  switch (kind) {
    case "markdown":
      return "Документ · MD";
    case "text":
      return "Текст · TXT";
    case "presentation-reveal":
      return "Презентация · HTML";
    case "presentation-pptx":
      return "Презентация · PPTX";
    case "image":
      return "Изображение";
    case "excel":
      return "Таблица · XLSX";
    default:
      return "Документ";
  }
}

function getArtifactFileExtension(kind: ArtifactKind): string {
  switch (kind) {
    case "markdown":
      return "md";
    case "text":
      return "txt";
    case "presentation-reveal":
      return "html";
    case "presentation-pptx":
      return "pptx";
    case "excel":
      return "xlsx";
    case "image":
      return "png";
    default:
      return "txt";
  }
}

function isImageContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

// --- Data extraction ---

function useExtractedMaterials(messages: ChatMessage[]) {
  const artifacts = useMemo(() => {
    const map = new Map<string, SidebarArtifact>();

    for (const message of messages) {
      if (!message.parts) continue;
      for (const part of message.parts) {
        if (
          part.type === "tool-createDocument" ||
          part.type === "tool-updateDocument"
        ) {
          const output = part.output as
            | { id?: string; title?: string; kind?: string }
            | undefined;
          if (output?.id && output.title && output.kind) {
            map.set(output.id, {
              id: output.id,
              title: output.title,
              kind: output.kind as ArtifactKind,
              messageId: message.id,
            });
          }
        }
      }
    }

    return Array.from(map.values());
  }, [messages]);

  const attachments = useMemo(() => {
    const list: SidebarAttachment[] = [];

    for (const message of messages) {
      if (!message.parts) continue;
      for (const part of message.parts) {
        if (part.type === "file") {
          list.push({
            name: (part as any).filename ?? "file",
            url: (part as any).url ?? "",
            contentType: (part as any).mediaType ?? "application/octet-stream",
            messageId: message.id,
          });
        }
      }
    }

    return list;
  }, [messages]);

  return { artifacts, attachments };
}

// --- Scroll + highlight ---

function scrollToMessage(messageId: string) {
  const el = document.getElementById(`message-${messageId}`);
  if (!el) return;

  el.scrollIntoView({ behavior: "smooth", block: "center" });

  // Brief highlight animation
  el.classList.add("sidebar-highlight");
  setTimeout(() => el.classList.remove("sidebar-highlight"), 2000);
}

// --- Download helpers ---

async function downloadArtifact(artifact: SidebarArtifact) {
  try {
    const res = await fetch(`/api/document?id=${artifact.id}`);
    if (!res.ok) return;
    const docs = await res.json();
    const doc = docs[0];
    if (!doc?.content) return;

    const ext = getArtifactFileExtension(artifact.kind);
    const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    // Silently fail
  }
}

// --- Component ---

export function ChatSidebar({ open, onClose, messages }: ChatSidebarProps) {
  const { artifacts, attachments } = useExtractedMaterials(messages);
  const isEmpty = artifacts.length === 0 && attachments.length === 0;

  const handleArtifactClick = useCallback((artifact: SidebarArtifact) => {
    scrollToMessage(artifact.messageId);
  }, []);

  const handleAttachmentClick = useCallback((attachment: SidebarAttachment) => {
    scrollToMessage(attachment.messageId);
  }, []);

  const handleArtifactDownload = useCallback(
    (e: MouseEvent, artifact: SidebarArtifact) => {
      e.stopPropagation();
      downloadArtifact(artifact);
    },
    []
  );

  const handleAttachmentDownload = useCallback((e: MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={cn(
        "fixed right-0 top-14 bottom-0 z-30 w-full md:w-[380px] flex flex-col border-l bg-background shadow-xl",
        "transition-transform duration-300 ease-in-out",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b px-4">
        <span className="font-semibold">Материалы чата</span>
        <button
          onClick={onClose}
          className="rounded-full p-2 hover:bg-muted transition-colors"
        >
          <X className="size-4" />
          <span className="sr-only">Закрыть</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Inbox className="size-10" />
            <p className="text-sm">Пока нет материалов</p>
            <p className="text-xs text-center max-w-60">
              Артефакты и вложения чата появятся здесь
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Artifacts section */}
            {artifacts.length > 0 && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <FileText className="size-3.5" />
                  Артефакты
                  <span className="ml-auto text-xs tabular-nums">
                    {artifacts.length}
                  </span>
                </h3>
                <div className="flex flex-col gap-1">
                  {artifacts.map((artifact) => (
                    <div
                      key={artifact.id}
                      onClick={() => handleArtifactClick(artifact)}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-all duration-150 cursor-pointer"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        {getArtifactIcon(artifact.kind)}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {artifact.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getArtifactFormatLabel(artifact.kind)}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleArtifactDownload(e, artifact)}
                        className="shrink-0 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                        title="Скачать"
                      >
                        <Download className="size-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Attachments section */}
            {attachments.length > 0 && (
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <Paperclip className="size-3.5" />
                  Вложения
                  <span className="ml-auto text-xs tabular-nums">
                    {attachments.length}
                  </span>
                </h3>
                <div className="flex flex-col gap-1">
                  {attachments.map((attachment, index) => (
                    <div
                      key={`${attachment.url}-${index}`}
                      onClick={() => handleAttachmentClick(attachment)}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-all duration-150 cursor-pointer"
                    >
                      {isImageContentType(attachment.contentType) ? (
                        <div className="size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="size-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <FileIcon className="size-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {attachment.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {attachment.contentType}
                        </span>
                      </div>
                      <a
                        href={attachment.url}
                        download={attachment.name}
                        onClick={handleAttachmentDownload}
                        className="shrink-0 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                        title="Скачать"
                      >
                        <Download className="size-3.5 text-muted-foreground" />
                      </a>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
