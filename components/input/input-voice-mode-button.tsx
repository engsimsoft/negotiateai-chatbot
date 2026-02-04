"use client";

import { memo, useState } from "react";
import { AudioLines } from "lucide-react";
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

/**
 * InputVoiceModeButton — кнопка голосового режима
 *
 * Двустороннее голосовое общение с AI
 * Сейчас: показывает "Скоро"
 * Потом: запускает голосовой режим
 */

interface InputVoiceModeButtonProps {
  className?: string;
}

function PureInputVoiceModeButton({ className }: InputVoiceModeButtonProps) {
  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleClick = () => {
    // TODO: когда будет готово, здесь будет запуск голосового режима
    setShowComingSoon(true);
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
              className={cn(
                "size-9 rounded-full",
                "text-muted-foreground",
                "hover:text-foreground hover:bg-accent",
                "transition-all duration-200",
                className
              )}
            >
              <AudioLines className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Голосовой режим
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={showComingSoon} onOpenChange={setShowComingSoon}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AudioLines className="size-5" />
              Голосовой режим
            </DialogTitle>
            <DialogDescription>
              Двустороннее голосовое общение с AI появится в ближайшем обновлении.
              Вы сможете разговаривать с помощником как по телефону.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-6">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-1 bg-primary rounded-full animate-pulse"
                  style={{
                    height: 8 + i * 4 + "px",
                    animationDelay: i * 100 + "ms",
                  }}
                />
              ))}
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Скоро
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const InputVoiceModeButton = memo(PureInputVoiceModeButton);
