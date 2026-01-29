"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeleteAgentDialogProps {
  agentName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteAgentDialog({
  agentName,
  onClose,
  onConfirm,
}: DeleteAgentDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg mx-4">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Удалить агента?</h2>
            <p className="text-muted-foreground mt-2">
              Ты уверен, что хочешь удалить &quot;{agentName}&quot;?
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Чаты с этим агентом останутся, но будут использовать стандартного
              агента из каталога.
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Удаление..." : "Удалить"}
          </Button>
        </div>
      </div>
    </div>
  );
}
