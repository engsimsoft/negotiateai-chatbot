"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MicrophoneIcon, StopIcon, LoaderIcon } from "@/components/icons";
import type { VoiceState } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface VoiceButtonProps {
  state: VoiceState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  className?: string;
}

function PureVoiceButton({
  state,
  onStart,
  onStop,
  disabled = false,
  className,
}: VoiceButtonProps) {
  const isRecording = state === "recording";
  const isProcessing = state === "processing";
  const isIdle = state === "idle" || state === "error";

  const handleClick = () => {
    if (isRecording) {
      onStop();
    } else if (isIdle) {
      onStart();
    }
  };

  const getTooltipText = () => {
    if (isRecording) return "Остановить запись";
    if (isProcessing) return "Обработка...";
    return "Голосовой ввод";
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={disabled || isProcessing}
          className={cn(
            "relative h-8 w-8 rounded-md",
            isRecording && "text-red-500 hover:text-red-600",
            className
          )}
          aria-label={getTooltipText()}
        >
          {isProcessing ? (
            <LoaderIcon size={18} />
          ) : isRecording ? (
            <>
              {/* Pulsing ring animation */}
              <span className="absolute inset-0 rounded-md animate-ping bg-red-500/20" />
              <StopIcon size={18} />
            </>
          ) : (
            <MicrophoneIcon size={18} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{getTooltipText()}</TooltipContent>
    </Tooltip>
  );
}

export const VoiceButton = memo(PureVoiceButton);
