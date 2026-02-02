"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type ProjectModelTier,
  DEFAULT_PROJECT_MODEL,
  getProjectModelTiers,
} from "@/lib/ai/model-tiers";

interface ModelSelectorProps {
  value?: ProjectModelTier;
  onValueChange: (value: ProjectModelTier) => void;
  disabled?: boolean;
}

export function ModelSelector({
  value = DEFAULT_PROJECT_MODEL,
  onValueChange,
  disabled = false,
}: ModelSelectorProps) {
  const tiers = getProjectModelTiers();
  const currentTier = tiers.find((t) => t.id === value) || tiers[1]; // default to expert

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as ProjectModelTier)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue>
          <span className="flex items-center gap-2">
            <span>{currentTier.icon}</span>
            <span>{currentTier.name}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {tiers.map((tier) => (
          <SelectItem key={tier.id} value={tier.id}>
            <div className="flex flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <span>{tier.icon}</span>
                <span className="font-medium">{tier.name}</span>
              </span>
              <span className="text-xs text-muted-foreground">
                {tier.description}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
