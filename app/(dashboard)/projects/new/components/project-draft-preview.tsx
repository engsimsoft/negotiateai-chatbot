"use client";

/**
 * Project Draft Preview
 *
 * Shows live preview of project draft during creation.
 * Fields update in real-time as AI fills them.
 *
 * ТЗ-10: Live Preview
 */

import { FileText, MessageSquare, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ProjectDraft {
  name: string;
  description: string;
  instruction: string;
}

interface ProjectDraftPreviewProps {
  draft: ProjectDraft;
  onDraftChange: (draft: ProjectDraft) => void;
  isComplete: boolean;
  onCreateProject?: () => void;
  isCreating?: boolean;
}

export function ProjectDraftPreview({
  draft,
  isComplete,
  onCreateProject,
  isCreating,
}: ProjectDraftPreviewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Паспорт проекта</h2>
        <p className="text-sm text-muted-foreground">
          Заполняется автоматически по ходу диалога
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Название</span>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 min-h-[48px]">
            {draft.name ? (
              <p className="font-medium">{draft.name}</p>
            ) : (
              <p className="text-muted-foreground italic">Ожидание...</p>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            <span>Описание</span>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 min-h-[72px]">
            {draft.description ? (
              <p className="text-sm">{draft.description}</p>
            ) : (
              <p className="text-muted-foreground italic text-sm">Ожидание...</p>
            )}
          </div>
        </div>

        {/* Instruction */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>Инструкция для AI</span>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 min-h-[96px]">
            {draft.instruction ? (
              <p className="text-sm whitespace-pre-wrap">{draft.instruction}</p>
            ) : (
              <p className="text-muted-foreground italic text-sm">Опционально</p>
            )}
          </div>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              isComplete ? "bg-green-500" : "bg-yellow-500"
            }`}
          />
          <span className="text-sm text-muted-foreground">
            {isComplete
              ? "Готово к созданию"
              : "Заполните название и описание"}
          </span>
        </div>

        {/* Create button */}
        {isComplete && (
          <Button
            onClick={onCreateProject}
            disabled={isCreating || !isComplete}
            className="w-full mt-4"
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Создание...
              </>
            ) : (
              "✓ Создать проект"
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
