"use client";

import { memo } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useInputContext } from "./input-context";

/**
 * InputSubmitButton — кнопка отправки
 *
 * Круглая, акцентная кнопка
 * Активируется когда есть текст
 */

interface InputSubmitButtonProps {
  className?: string;
}

function PureInputSubmitButton({ className }: InputSubmitButtonProps) {
  const { handleSubmit, canSubmit, isSubmitting } = useInputContext();

  return (
    <Button
      type="button"
      size="icon"
      onClick={handleSubmit}
      disabled={!canSubmit}
      className={cn(
        // Shape
        "size-9 rounded-full",
        // Active state
        canSubmit && [
          "bg-foreground text-background",
          "hover:bg-foreground/90",
          "hover:scale-105",
          "shadow-md",
        ],
        // Disabled state
        !canSubmit && [
          "bg-muted text-muted-foreground",
          "cursor-not-allowed",
        ],
        // Transition
        "transition-all duration-200 ease-out",
        // Loading
        isSubmitting && "animate-pulse",
        className
      )}
    >
      <ArrowUp className="size-5" />
    </Button>
  );
}

export const InputSubmitButton = memo(PureInputSubmitButton);
