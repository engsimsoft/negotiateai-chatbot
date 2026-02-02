"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Image,
  Music,
  Video,
  File,
  Trash2,
  Loader2,
  Table,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectFile } from "@/lib/db/schema";

interface ProjectFilesProps {
  projectId: string;
  initialFiles: ProjectFile[];
}

function getFileIcon(type: string) {
  switch (type) {
    case "document":
      return <FileText className="size-4" />;
    case "table":
      return <Table className="size-4" />;
    case "image":
      return <Image className="size-4" />;
    case "audio":
      return <Music className="size-4" />;
    case "video":
      return <Video className="size-4" />;
    default:
      return <File className="size-4" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectFiles({ projectId, initialFiles }: ProjectFilesProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(initialFiles);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);

    try {
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Upload failed:", error);
          continue;
        }

        const newFile = await response.json();
        setFiles((prev) => [newFile, ...prev]);
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to upload files:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDelete = async (fileId: string) => {
    setDeletingId(fileId);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/files/${fileId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      router.refresh();
    } catch (error) {
      console.error("Failed to delete file:", error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Документы</CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp,.mp3,.wav,.m4a,.mp4,.mov,.webm"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="size-4 mr-1 animate-spin" />
              ) : (
                <Upload className="size-4 mr-1" />
              )}
              Загрузить
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Нет загруженных файлов. Добавьте документы для контекста AI.
          </p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {file.metadata?.extractedContent && (
                      <span className="ml-2 text-green-600">
                        Контент извлечён
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(file.id)}
                  disabled={deletingId === file.id}
                >
                  {deletingId === file.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
