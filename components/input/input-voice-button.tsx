"use client";

import { memo } from "react";
import { Mic } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { useInputContext } from "./input-context";

/**
 * InputVoiceButton — кнопка диктовки (Speech-to-Text)
 *
 * Использует Deepgram для распознавания речи
 * При записи показывает анимацию
 */

interface InputVoiceButtonProps {
  className?: string;
}

function PureInputVoiceButton({ className }: InputVoiceButtonProps) {
  const { setValue, disabled } = useInputContext();

  const {
    state: voiceState,
    isAvailable,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({
    onTranscript: (text) => {
      setValue((prev) => (prev ? prev + " " + text : text));
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isAvailable) {
    return null;
  }

  const isRecording = voiceState === "recording" || voiceState === "processing";

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
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
              // Recording state
              isRecording && [
                "text-red-500 hover:text-red-600",
                "bg-red-500/10 hover:bg-red-500/20",
                "animate-pulse",
              ],
              className
            )}
          >
            <Mic className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isRecording ? "Остановить запись" : "Диктовать"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const InputVoiceButton = memo(PureInputVoiceButton);
