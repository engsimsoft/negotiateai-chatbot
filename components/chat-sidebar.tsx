"use client";

/**
 * ТЗ-08: Chat Sidebar — панель материалов чата
 *
 * Использует RightSidebar (унифицированный shell):
 * - Секция "Артефакты": документы, созданные AI (createDocument/updateDocument)
 * - Секция "Вложения": файлы, прикреплённые пользователем
 * - Empty state когда списки пусты
 * - Клик по элементу → scroll к сообщению + highlight (навигация по чату)
 * - Кнопка скачивания на каждом элементе
 */

import { type MouseEvent, useCallback, useMemo } from "react";
import {
  FileText,
  Image,
  Table,
  Presentation,
  FileIcon,
  Inbox,
  Download,
} from "lucide-react";
import { RightSidebar } from "@/components/right-sidebar";
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
      return <FileText className="size-4 text-sidebar-foreground/70" />;
    case "image":
      return <Image className="size-4 text-sidebar-foreground/70" />;
    case "excel":
      return <Table className="size-4 text-sidebar-foreground/70" />;
    case "presentation-reveal":
    case "presentation-pptx":
      return <Presentation className="size-4 text-sidebar-foreground/70" />;
    default:
      return <FileText className="size-4 text-sidebar-foreground/70" />;
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
    <RightSidebar open={open} onClose={onClose} title="Материалы чата">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-sidebar-foreground/50">
          <Inbox className="size-10" />
          <p className="text-sm">Пока нет материалов</p>
          <p className="text-xs text-center max-w-60">
            Артефакты и вложения чата появятся здесь
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-2">
          {/* Artifacts section */}
          {artifacts.length > 0 && (
            <section>
              <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
                Артефакты · {artifacts.length}
              </div>
              <div className="flex flex-col gap-0.5">
                {artifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    type="button"
                    onClick={() => handleArtifactClick(artifact)}
                    className="group flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
                      {getArtifactIcon(artifact.kind)}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {artifact.title}
                      </span>
                      <span className="text-xs text-sidebar-foreground/50">
                        {getArtifactFormatLabel(artifact.kind)}
                      </span>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleArtifactDownload(e, artifact)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleArtifactDownload(e as unknown as MouseEvent, artifact);
                        }
                      }}
                      className="shrink-0 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sidebar-accent"
                      title="Скачать"
                    >
                      <Download className="size-3.5 text-sidebar-foreground/70" />
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Attachments section */}
          {attachments.length > 0 && (
            <section>
              <div className="flex h-8 items-center px-2 text-xs font-medium text-sidebar-foreground/70">
                Вложения · {attachments.length}
              </div>
              <div className="flex flex-col gap-0.5">
                {attachments.map((attachment, index) => (
                  <button
                    key={`${attachment.url}-${index}`}
                    type="button"
                    onClick={() => handleAttachmentClick(attachment)}
                    className="group flex w-full items-center gap-2 rounded-md p-2 text-left transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    {isImageContentType(attachment.contentType) ? (
                      <div className="size-8 shrink-0 overflow-hidden rounded-md bg-sidebar-accent">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attachment.url}
                          alt={attachment.name}
                          className="size-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-accent">
                        <FileIcon className="size-4 text-sidebar-foreground/70" />
                      </div>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {attachment.name}
                      </span>
                      <span className="text-xs text-sidebar-foreground/50">
                        {attachment.contentType}
                      </span>
                    </div>
                    <a
                      href={attachment.url}
                      download={attachment.name}
                      onClick={handleAttachmentDownload}
                      className="shrink-0 rounded-md p-1.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sidebar-accent"
                      title="Скачать"
                    >
                      <Download className="size-3.5 text-sidebar-foreground/70" />
                    </a>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </RightSidebar>
  );
}
