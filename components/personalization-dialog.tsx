"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/toast";
import type { AgentCustomizations } from "@/lib/db/schema";
import { generateUUID } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  icon: string;
}

interface PersonalizationDialogProps {
  agent: Agent;
  onClose: () => void;
  onSuccess?: () => void;
  // For edit mode
  editMode?: boolean;
  existingData?: {
    id: string;
    name: string;
    customizations: AgentCustomizations | null;
  };
}

type CommunicationStyle = "friendly" | "formal" | "expert";

const STYLE_OPTIONS: {
  value: CommunicationStyle;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "friendly",
    label: "Дружелюбный",
    icon: "😊",
    description: "Как с коллегой, неформально",
  },
  {
    value: "formal",
    label: "Деловой",
    icon: "💼",
    description: "Чётко и по делу, без лишнего",
  },
  {
    value: "expert",
    label: "Экспертный",
    icon: "🎓",
    description: "Подробно и профессионально",
  },
];

const STYLE_CONFIRMATIONS: Record<CommunicationStyle, string> = {
  friendly: "Дружелюбный стиль — отличный выбор для комфортной работы.",
  formal: "Деловой стиль — хороший выбор для работы.",
  expert: "Экспертный стиль — когда важны детали и глубина.",
};

export function PersonalizationDialog({
  agent,
  onClose,
  onSuccess,
  editMode = false,
  existingData,
}: PersonalizationDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(
    existingData?.name || `Мой ${agent.name.toLowerCase()}`
  );
  const [style, setStyle] = useState<CommunicationStyle>(
    (existingData?.customizations?.communicationStyle as CommunicationStyle) ||
      "friendly"
  );
  const [specialization, setSpecialization] = useState(
    existingData?.customizations?.specialization || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const totalSteps = 4;

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleNext = () => {
    if (step === 1 && !name.trim()) return;
    setStep(step + 1);
  };

  const handleStyleSelect = (selectedStyle: CommunicationStyle) => {
    setStyle(selectedStyle);
    setStep(3);
  };

  const handleSkipSpecialization = () => {
    setSpecialization("");
    setStep(4);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const customizations: AgentCustomizations = {
        communicationStyle: style,
        ...(specialization.trim() && { specialization: specialization.trim() }),
      };

      if (editMode && existingData) {
        // Update existing agent
        const res = await fetch(`/api/user-agents/${existingData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), customizations }),
        });

        if (!res.ok) throw new Error("Failed to update");
        setStep(5);
      } else {
        // Create new agent
        const res = await fetch("/api/user-agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceAgentId: agent.id,
            name: name.trim(),
            customizations,
          }),
        });

        if (!res.ok) throw new Error("Failed to create");
        const data = await res.json();
        setCreatedAgentId(data.id);
        setStep(5);
      }

      onSuccess?.();
    } catch {
      toast({
        type: "error",
        description: editMode
          ? "Ошибка при сохранении агента"
          : "Ошибка при создании агента",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartChat = () => {
    const agentId = createdAgentId || existingData?.id;
    if (agentId) {
      const newChatId = generateUUID();
      router.push(`/chat/${newChatId}?agentId=${agentId}`);
    }
    onClose();
  };

  const getStyleLabel = (s: CommunicationStyle) =>
    STYLE_OPTIONS.find((o) => o.value === s)?.label || s;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border bg-background shadow-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-semibold">
            {editMode ? "Редактирование агента" : "Настройка агента"}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[350px]">
          {/* Step 1: Name */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Помощник
                  </p>
                  <p className="text-lg">
                    {editMode
                      ? `Редактируем "${existingData?.name}".`
                      : `Отлично! Давай настроим ${agent.name} под тебя.`}
                  </p>
                  <p className="mt-2">Как хочешь его назвать?</p>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`Мой ${agent.name.toLowerCase()}`}
                  maxLength={100}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) handleNext();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Например: &quot;{agent.name} Макс&quot;, &quot;Мой{" "}
                  {agent.name.toLowerCase()}&quot;
                </p>
              </div>

              <div className="flex justify-end gap-3">
                {editMode && (
                  <Button variant="outline" onClick={handleNext}>
                    Оставить как есть
                  </Button>
                )}
                <Button onClick={handleNext} disabled={!name.trim()}>
                  Далее
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Style */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Помощник
                  </p>
                  <p className="text-lg">&quot;{name}&quot; — отличное имя!</p>
                  <p className="mt-2">Какой стиль общения предпочитаешь?</p>
                </div>
              </div>

              <div className="space-y-3">
                {STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleStyleSelect(option.value)}
                    className={`w-full text-left rounded-lg border p-4 transition-colors hover:bg-accent/50 ${
                      style === option.value ? "border-primary bg-accent/30" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{option.icon}</span>
                      <div>
                        <p className="font-medium">{option.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              <Button variant="outline" onClick={handleBack} className="w-full">
                <ArrowLeft className="mr-2 size-4" />
                Назад
              </Button>
            </div>
          )}

          {/* Step 3: Specialization */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Помощник
                  </p>
                  <p className="text-lg">{STYLE_CONFIRMATIONS[style]}</p>
                  <p className="mt-2">
                    Есть ли узкая специализация для этого агента? Это поможет
                    давать более точные советы.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Input
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="SMM и контент-маркетинг"
                  maxLength={200}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setStep(4);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  💡 Например: &quot;B2B продажи&quot;, &quot;IT-стартапы&quot;,
                  &quot;Ресторанный бизнес&quot;
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleSkipSpecialization}
                  className="flex-1"
                >
                  Пропустить
                </Button>
                <Button onClick={() => setStep(4)} className="flex-1">
                  Далее
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🤝</span>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Помощник
                  </p>
                  <p className="text-lg">Готово! 🎉</p>
                  <p className="mt-2">
                    {editMode ? "Сохраняем" : "Создаю"} &quot;{name}&quot;:
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="font-medium">📋 Настройки:</p>
                <ul className="space-y-1 text-sm">
                  <li>• Стиль: {getStyleLabel(style)}</li>
                  {specialization && <li>• Специализация: {specialization}</li>}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Агент будет использовать твои настройки из профиля (имя,
                  обращение).
                </p>
              </div>

              <p className="text-center text-sm">Всё верно?</p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 size-4" />
                  Изменить
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    "Сохранение..."
                  ) : (
                    <>
                      <Check className="mr-2 size-4" />
                      {editMode ? "Сохранить" : "Создать агента"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="flex items-start gap-3 text-left">
                <span className="text-2xl">🤝</span>
                <div>
                  <p className="font-medium text-muted-foreground mb-1">
                    Помощник
                  </p>
                  <p className="text-lg">&quot;{name}&quot; готов к работе!</p>
                  <p className="mt-2">
                    {editMode
                      ? "Изменения сохранены."
                      : "Найдёшь его в разделе «Мои агенты» в боковом меню."}
                  </p>
                </div>
              </div>

              <div className="flex justify-center py-4">
                <div className="size-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Check className="size-10 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Закрыть
                </Button>
                <Button onClick={handleStartChat} className="flex-1">
                  <MessageCircle className="mr-2 size-4" />
                  Начать чат
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {step <= totalSteps && (
          <div className="border-t px-6 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Шаг {step} из {totalSteps}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`size-2 rounded-full transition-colors ${
                    i < step ? "bg-primary" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
