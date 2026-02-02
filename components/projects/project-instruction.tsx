"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Save, X, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectInstructionProps {
  projectId: string;
  initialInstruction: string;
}

export function ProjectInstruction({
  projectId,
  initialInstruction,
}: ProjectInstructionProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [instruction, setInstruction] = useState(initialInstruction);
  const [editValue, setEditValue] = useState(initialInstruction);

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: editValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to update instruction");
      }

      setInstruction(editValue);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to update instruction:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(instruction);
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Инструкция для AI</CardTitle>
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="size-4 mr-1" />
              Редактировать
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Опишите контекст проекта, целевую аудиторию, тон общения и другие важные детали для AI..."
              rows={6}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="size-4 mr-1" />
                Отмена
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="size-4 mr-1 animate-spin" />
                ) : (
                  <Save className="size-4 mr-1" />
                )}
                Сохранить
              </Button>
            </div>
          </div>
        ) : instruction ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {instruction}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Инструкция не задана. Добавьте контекст для более точных ответов AI.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
