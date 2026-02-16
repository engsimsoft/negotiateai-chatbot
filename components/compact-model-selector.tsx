"use client";

import { memo, useEffect, useState, startTransition } from "react";
import { Trigger } from "@radix-ui/react-select";
import { ChevronDown, Cpu } from "lucide-react";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { SelectItem } from "@/components/ui/select";
import { chatModels } from "@/lib/ai/models";
import {
  getProjectModelTiers,
  type ProjectModelTier,
} from "@/lib/ai/model-tiers";
import {
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from "./elements/prompt-input";

/**
 * Компактный селектор модели для инпутов
 *
 * Два режима:
 * - provider="google" — модели Claude (для универсальных чатов)
 * - provider="anthropic" — модели Claude (для проектов)
 */

interface CompactModelSelectorProps {
  provider: "google" | "anthropic";
  // Google mode
  selectedModelId?: string;
  onModelChange?: (modelId: string) => void;
  // Anthropic mode
  selectedTier?: ProjectModelTier;
  onTierChange?: (tier: ProjectModelTier) => void;
}

function PureCompactModelSelector({
  provider,
  selectedModelId,
  onModelChange,
  selectedTier,
  onTierChange,
}: CompactModelSelectorProps) {
  // Google state
  const [optimisticModelId, setOptimisticModelId] = useState(
    selectedModelId || "auto"
  );

  // Anthropic state
  const [optimisticTier, setOptimisticTier] = useState<ProjectModelTier>(
    selectedTier || "expert"
  );

  useEffect(() => {
    if (selectedModelId) {
      setOptimisticModelId(selectedModelId);
    }
  }, [selectedModelId]);

  useEffect(() => {
    if (selectedTier) {
      setOptimisticTier(selectedTier);
    }
  }, [selectedTier]);

  // Anthropic Claude models
  if (provider === "anthropic") {
    const projectModels = getProjectModelTiers();
    const selectedModel = projectModels.find((m) => m.id === optimisticTier);

    return (
      <PromptInputModelSelect
        onValueChange={(modelName) => {
          const model = projectModels.find((m) => m.name === modelName);
          if (model) {
            setOptimisticTier(model.id);
            onTierChange?.(model.id);
            startTransition(() => {
              document.cookie = `project-model-tier=${model.id};path=/;max-age=31536000`;
            });
          }
        }}
        value={selectedModel?.name}
      >
        <Trigger
          className="flex h-8 items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0"
          type="button"
        >
          <span className="text-sm">{selectedModel?.icon}</span>
          <span className="font-medium text-xs">{selectedModel?.name}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Trigger>
        <PromptInputModelSelectContent className="min-w-[240px] p-0">
          <div className="flex flex-col gap-px">
            {projectModels.map((model) => (
              <SelectItem key={model.id} value={model.name}>
                <div className="flex items-center gap-2">
                  <span>{model.icon}</span>
                  <div>
                    <div className="truncate font-medium text-xs">
                      {model.name}
                    </div>
                    <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                      {model.description}
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </div>
        </PromptInputModelSelectContent>
      </PromptInputModelSelect>
    );
  }

  // Claude models
  const selectedModel = chatModels.find((m) => m.id === optimisticModelId);

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger
        className="flex h-8 items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 text-foreground shadow-none transition-colors hover:bg-accent focus:outline-none focus:ring-0"
        type="button"
      >
        <Cpu className="size-4" />
        <span className="font-medium text-xs">{selectedModel?.name}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[240px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem key={model.id} value={model.name}>
              <div className="truncate font-medium text-xs">{model.name}</div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {model.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

export const CompactModelSelector = memo(PureCompactModelSelector);
