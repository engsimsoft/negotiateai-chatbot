"use client";

import Link from "next/link";
import { FileText, FolderOpen, ExternalLink, File } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Project, ProjectFile } from "@/lib/db/schema";

interface ProjectContextPanelProps {
  project: Project;
  files: ProjectFile[];
}

export function ProjectContextPanel({ project, files }: ProjectContextPanelProps) {
  return (
    <div className="hidden lg:flex w-[300px] flex-col border-l bg-muted/30">
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Project header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="size-5 text-primary" />
              <h2 className="font-semibold truncate">{project.name}</h2>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}
          </div>

          {/* Instruction */}
          {project.instruction && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <FileText className="size-4" />
                Инструкция
              </h3>
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {project.instruction}
                </p>
              </div>
            </div>
          )}

          {/* Files */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <File className="size-4" />
              Документы ({files.length})
            </h3>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Нет загруженных документов
              </p>
            ) : (
              <ul className="space-y-1">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 rounded-md bg-muted px-2 py-1.5"
                  >
                    <FileIcon mimeType={file.mimeType} />
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link href={`/projects/${project.id}`}>
            <ExternalLink className="size-4 mr-2" />
            Открыть проект
          </Link>
        </Button>
      </div>
    </div>
  );
}

function FileIcon({ mimeType }: { mimeType: string }) {
  // Simple file icon based on mime type
  return <FileText className="size-4 text-muted-foreground shrink-0" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
