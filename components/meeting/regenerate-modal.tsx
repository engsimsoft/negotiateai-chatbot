// ТЗ-MR2 Этап 2: Modal for regenerating meeting summary with different format/instructions

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type SummaryLevel = "compact" | "standard" | "detailed";

const SUMMARY_OPTIONS: { value: SummaryLevel; label: string; description: string }[] = [
  { value: "compact", label: "Сводка", description: "Ключевые решения и задачи (~1 стр)" },
  { value: "standard", label: "Протокол", description: "Темы, решения, задачи, вопросы (~2-3 стр)" },
  { value: "detailed", label: "Детальный", description: "Полная хронология с тайм-кодами" },
];

interface RegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSummaryLevel: string;
  currentInstructions?: string | null;
  onRegenerate: (summaryLevel: SummaryLevel, userInstructions: string | null) => Promise<void>;
}

export function RegenerateModal({
  open,
  onOpenChange,
  currentSummaryLevel,
  currentInstructions,
  onRegenerate,
}: RegenerateModalProps) {
  const [summaryLevel, setSummaryLevel] = useState<SummaryLevel>(
    (currentSummaryLevel as SummaryLevel) || "standard",
  );
  const [instructions, setInstructions] = useState(currentInstructions ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  const handleOpenChange = (value: boolean) => {
    if (value) {
      setSummaryLevel((currentSummaryLevel as SummaryLevel) || "standard");
      setInstructions(currentInstructions ?? "");
      setError(null);
    }
    onOpenChange(value);
  };

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onRegenerate(summaryLevel, instructions.trim() || null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось создать документ. Попробуйте ещё раз.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Создать другой отчёт</DialogTitle>
          <DialogDescription>
            Выберите формат и добавьте инструкции. Транскрипция будет использована повторно.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Summary level selector */}
          <div>
            <h4 className="mb-2 text-sm font-medium">Формат документа</h4>
            <div className="flex flex-col gap-2">
              {SUMMARY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                    summaryLevel === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  } ${isLoading ? "pointer-events-none opacity-50" : ""}`}
                >
                  <input
                    type="radio"
                    name="regenerateSummaryLevel"
                    value={option.value}
                    checked={summaryLevel === option.value}
                    onChange={() => setSummaryLevel(option.value)}
                    disabled={isLoading}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* User instructions */}
          <div>
            <h4 className="mb-2 text-sm font-medium">
              Инструкции{" "}
              <span className="font-normal text-muted-foreground">(необязательно)</span>
            </h4>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={2000}
              rows={3}
              disabled={isLoading}
              placeholder="Фокус на задачах, детали по бюджету..."
              className="w-full resize-none rounded-lg border bg-muted/30 p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Создаём документ...
              </>
            ) : (
              "Создать"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
