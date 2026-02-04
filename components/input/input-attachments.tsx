"use client";

import { memo, useState } from "react";
import { Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useInputContext } from "./input-context";

/**
 * InputAttachments — кнопка прикрепления файлов
 *
 * На странице чата: работает полноценно
 * На главной/проекте: показывает "Скоро" (redirect mode не поддерживает)
 */

interface InputAttachmentsProps {
  className?: string;
  // For full mode (chat page)
  onAttach?: () => void;
}

function PureInputAttachments({ className, onAttach }: InputAttachmentsProps) {
  const { mode, disabled } = useInputContext();
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleClick = () => {
    if (mode === "send" && onAttach) {
      // Full mode: trigger file picker
      onAttach();
    } else {
      // Redirect mode: show coming soon
      setShowComingSoon(true);
    }
  };

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClick}
              disabled={disabled}
              className={cn(
                "size-9 rounded-full",
                "text-muted-foreground",
                "hover:text-foreground hover:bg-accent",
                "transition-all duration-200",
                className
              )}
            >
              <Paperclip className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Прикрепить файл
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paperclip className="size-5" />
              Прикрепление файлов
            </DialogTitle>
            <DialogDescription>
              Прикрепление файлов доступно в чате. Начните диалог, и вы сможете
              прикреплять изображения, PDF, документы и таблицы.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const InputAttachments = memo(PureInputAttachments);
