"use client";

import Link from "next/link";
import { FolderOpen, MessageSquare, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    fileCount: number;
    chatCount: number;
    updatedAt: Date;
  };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const updatedAgo = formatDistanceToNow(project.updatedAt, {
    addSuffix: true,
    locale: ru,
  });

  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="transition-colors hover:bg-muted/50 cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpen className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{project.name}</CardTitle>
              {project.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="size-3" />
              {project.fileCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3" />
              {project.chatCount}
            </span>
            <span className="ml-auto">{updatedAgo}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
