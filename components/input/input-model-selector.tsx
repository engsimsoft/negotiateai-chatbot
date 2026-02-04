"use client";

import { memo, startTransition } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { chatModels } from "@/lib/ai/models";
import { getProjectModelTiers } from "@/lib/ai/model-tiers";
import { useInputContext } from "./input-context";

/**
 * InputModelSelector — селектор модели
 *
 * Автоматически показывает нужные модели:
 * - provider="google" → Gemini модели
 * - provider="anthropic" → Claude модели
 */

interface InputModelSelectorProps {
  className?: string;
}

function PureInputModelSelector({ className }: InputModelSelectorProps) {
  const {
    provider,
    selectedModelId,
    setSelectedModelId,
    selectedTier,
    setSelectedTier,
    disabled,
  } = useInputContext();

  if (provider === "anthropic") {
    const models = getProjectModelTiers();
    const selected = models.find((m) => m.id === selectedTier);

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            variant="ghost"
            className={cn(
              "h-9 px-3 gap-1.5",
              "text-sm font-medium",
              "text-muted-foreground hover:text-foreground",
              "transition-colors duration-200",
              className
            )}
          >
            <span>{selected?.icon}</span>
            <span className="hidden sm:inline">{selected?.name}</span>
            <ChevronDown className="size-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {models.map((model) => (
            <DropdownMenuItem
              key={model.id}
              onClick={() => {
                setSelectedTier(model.id);
                startTransition(() => {
                  document.cookie = `project-model-tier=${model.id};path=/;max-age=31536000`;
                });
              }}
              className={cn(
                "flex items-start gap-3 py-3",
                model.id === selectedTier && "bg-accent"
              )}
            >
              <span className="text-lg">{model.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-muted-foreground">
                  {model.description}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Google Gemini models
  const selected = chatModels.find((m) => m.id === selectedModelId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          className={cn(
            "h-9 px-3 gap-1.5",
            "text-sm font-medium",
            "text-muted-foreground hover:text-foreground",
            "transition-colors duration-200",
            className
          )}
        >
          <span className="hidden sm:inline">{selected?.name}</span>
          <span className="sm:hidden">
            {selected?.name === "Авто (рекомендуется)" ? "Авто" : selected?.name}
          </span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {chatModels.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => {
              setSelectedModelId(model.id);
              startTransition(() => {
                saveChatModelAsCookie(model.id);
              });
            }}
            className={cn(
              "flex flex-col items-start gap-1 py-3",
              model.id === selectedModelId && "bg-accent"
            )}
          >
            <div className="font-medium">{model.name}</div>
            <div className="text-xs text-muted-foreground">
              {model.description}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const InputModelSelector = memo(PureInputModelSelector);
