"use client";

import { Image as ImageIcon, Video, FileText, Mic, Sticker, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MessageClient {
  id: string;
  groupId: string;
  topicId: string | null;
  telegramMessageId: number;
  fromUserId: number;
  fromUsername: string | null;
  fromFirstName: string | null;
  text: string;
  hasMedia: boolean;
  mediaType: string | null;
  fileName: string | null;
  fileSize: number | null;
  blobUrl: string | null;
  sentAt: string;
  createdAt: string;
}

const mediaIcons: Record<string, typeof ImageIcon> = {
  photo: ImageIcon,
  video: Video,
  document: FileText,
  voice: Mic,
  sticker: Sticker,
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function getAuthorName(msg: MessageClient): string {
  if (msg.fromFirstName) return msg.fromFirstName;
  if (msg.fromUsername) return `@${msg.fromUsername}`;
  return `User ${msg.fromUserId}`;
}

interface GroupMessageListProps {
  messages: MessageClient[];
  onDeleteMessage?: (messageId: string) => void;
}

export function GroupMessageList({ messages, onDeleteMessage }: GroupMessageListProps) {
  return (
    <div className="divide-y">
      {messages.map((msg) => {
        const MediaIcon = msg.mediaType
          ? mediaIcons[msg.mediaType] || ImageIcon
          : null;

        const isPhoto = msg.mediaType === "photo" && msg.blobUrl;

        return (
          <div key={msg.id} className="group/msg flex items-start gap-2 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium truncate">
                  {getAuthorName(msg)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {msg.hasMedia && MediaIcon && (
                    <MediaIcon className="size-3 text-muted-foreground" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatTime(msg.sentAt)}
                  </span>
                </div>
              </div>

              {/* Photo preview */}
              {isPhoto && (
                <a href={msg.blobUrl!} target="_blank" rel="noopener noreferrer" className="mt-1.5 block">
                  <img
                    src={msg.blobUrl!}
                    alt="Фото"
                    className="max-w-[280px] max-h-[200px] rounded-md border object-cover"
                  />
                </a>
              )}

              {/* File attachment (document, video, voice) */}
              {msg.blobUrl && !isPhoto && (
                <a
                  href={msg.blobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm hover:bg-muted/60 transition-colors max-w-[320px]"
                >
                  <Download className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">
                      {msg.fileName || "Файл"}
                    </p>
                    {msg.fileSize != null && (
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(msg.fileSize)}
                      </p>
                    )}
                  </div>
                </a>
              )}

              {/* Text (skip placeholder text like [Документ] when file is attached) */}
              {msg.text && !(msg.blobUrl && /^\[.+\]$/.test(msg.text)) && (
                <p className="mt-0.5 text-sm text-muted-foreground whitespace-pre-wrap break-words">
                  {msg.text}
                </p>
              )}
            </div>
            {onDeleteMessage && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0 opacity-0 group-hover/msg:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                onClick={() => onDeleteMessage(msg.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
