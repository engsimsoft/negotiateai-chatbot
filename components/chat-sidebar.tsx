"use client";

/**
 * ТЗ-08: Chat Sidebar — панель материалов чата
 *
 * Push-drawer справа (паттерн manager-drawer):
 * - Секция "Артефакты": документы, созданные AI (createDocument/updateDocument)
 * - Секция "Вложения": файлы, прикреплённые пользователем
 * - Empty state когда списки пусты
 */

import { useMemo } from "react";
import {
  X,
  FileText,
  Image,
  Table,
  Presentation,
  Paperclip,
  FileIcon,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ArtifactKind } from "@/components/artifact";
import type { ChatMessage } from "@/lib/types";

// --- Types ---

interface SidebarArtifact {
  id: string;
  title: string;
  kind: ArtifactKind;
}

interface SidebarAttachment {
  name: string;
  url: string;
  contentType: string;
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
          });
        }
      }
    }

    return list;
  }, [messages]);

  return { artifacts, attachments };
}

// --- Component ---

export function ChatSidebar({ open, onClose, messages }: ChatSidebarProps) {
  const { artifacts, attachments } = useExtractedMaterials(messages);
  const isEmpty = artifacts.length === 0 && attachments.length === 0;

  return (
    <div
      className={cn(
        "fixed right-0 top-[3.5rem] bottom-0 z-30 w-full md:w-[380px] flex flex-col border-l bg-background shadow-xl",
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
            <p className="text-xs text-center max-w-[240px]">
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-all duration-150 cursor-pointer"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        {getArtifactIcon(artifact.kind)}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {artifact.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getArtifactFormatLabel(artifact.kind)}
                        </span>
                      </div>
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
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 transition-all duration-150 cursor-pointer"
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
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {attachment.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {attachment.contentType}
                        </span>
                      </div>
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
