"use client";

import { useState } from "react";
import { ArrowRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/toast";

const OCCUPATION_OPTIONS = [
  "Маркетинг и реклама",
  "IT и разработка",
  "Продажи",
  "HR и рекрутинг",
  "Финансы",
  "Юриспруденция",
  "Образование",
  "Медиа и контент",
  "Консалтинг",
  "E-commerce",
  "Производство",
  "Другое",
];

interface OnboardingDialogProps {
  onComplete: () => void;
  /** ТЗ-NEW-01: Called after onboarding to show Ben intro (if user hasn't seen it) */
  onOpenBen?: () => void;
}

export function OnboardingDialog({ onComplete, onOpenBen }: OnboardingDialogProps) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [pronouns, setPronouns] = useState("вы");
  const [occupation, setOccupation] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = () => {
    if (step === 1 && !displayName.trim()) {
      return;
    }
    setStep(step + 1);
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          pronouns,
          occupation: occupation || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      onComplete();

      // ТЗ-NEW-01: Open Ben intro for new users
      if (onOpenBen) {
        onOpenBen();
      }
    } catch {
      toast({ type: "error", description: "Ошибка при сохранении профиля" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-lg mx-4">
        {/* Progress indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">
                Добро пожаловать в Simply! 👋
              </h2>
              <p className="text-muted-foreground mt-2">
                Давайте познакомимся. Как вас зовут?
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-name">Ваше имя</Label>
              <Input
                id="onboarding-name"
                placeholder="Например: Владимир"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && displayName.trim()) {
                    handleNext();
                  }
                }}
              />
            </div>

            <Button
              onClick={handleNext}
              disabled={!displayName.trim()}
              className="w-full"
            >
              Далее
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">
                Приятно познакомиться, {displayName}!
              </h2>
              <p className="text-muted-foreground mt-2">
                Как вам удобнее общаться с агентами?
              </p>
            </div>

            <RadioGroup
              value={pronouns}
              onValueChange={setPronouns}
              className="grid gap-3"
            >
              <div
                className="flex items-center space-x-3 rounded-md border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setPronouns("ты")}
              >
                <RadioGroupItem value="ты" id="onboarding-ty" />
                <div>
                  <Label htmlFor="onboarding-ty" className="font-medium cursor-pointer">
                    На &quot;ты&quot;
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Неформальное общение
                  </p>
                </div>
              </div>
              <div
                className="flex items-center space-x-3 rounded-md border p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setPronouns("вы")}
              >
                <RadioGroupItem value="вы" id="onboarding-vy" />
                <div>
                  <Label htmlFor="onboarding-vy" className="font-medium cursor-pointer">
                    На &quot;вы&quot;
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Формальное общение
                  </p>
                </div>
              </div>
            </RadioGroup>

            <Button onClick={handleNext} className="w-full">
              Далее
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold">Последний шаг!</h2>
              <p className="text-muted-foreground mt-2">
                Ваша сфера деятельности поможет агентам давать более релевантные
                ответы.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-occupation">Сфера деятельности</Label>
              <Select value={occupation} onValueChange={setOccupation}>
                <SelectTrigger id="onboarding-occupation">
                  <SelectValue placeholder="Выберите сферу" />
                </SelectTrigger>
                <SelectContent>
                  {OCCUPATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleComplete}
                disabled={isSaving}
                className="flex-1"
              >
                <SkipForward className="mr-2 size-4" />
                Пропустить
              </Button>
              <Button
                onClick={handleComplete}
                disabled={isSaving}
                className="flex-1"
              >
                {isSaving ? "Сохранение..." : "Начать работу"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
