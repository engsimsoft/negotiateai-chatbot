"use client";

import { useState } from "react";
import useSWR from "swr";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/toast";
import { fetcher } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemoryFact {
  id: string;
  content: string;
  category: string;
  confidence: number;
  sourceType: string;
  sourceChatId: string | null;
  createdAt: string;
}

interface MemoryData {
  facts: MemoryFact[];
  total: number;
  profile: {
    generatedAt: string;
    factCount: number;
    tokenCount: number;
  } | null;
}

type FactExtractionStrategy = "always" | "on-visit" | "cron";

interface MemorySettingsData {
  memoryEnabled: boolean;
  factExtractionStrategy: FactExtractionStrategy;
  factCount: number;
  profile: {
    generatedAt: string;
    factCount: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  fact: { label: "Факт", className: "bg-muted text-muted-foreground" },
  task: { label: "Задача", className: "bg-info/10 text-info" },
  preference: { label: "Предпочтение", className: "bg-warning/10 text-warning" },
  calendar: { label: "Событие", className: "bg-success/10 text-success" },
  person: { label: "Человек", className: "bg-accent text-accent-foreground" },
  decision: { label: "Решение", className: "bg-primary/10 text-primary" },
};

// ---------------------------------------------------------------------------
// MemorySection
// ---------------------------------------------------------------------------

export function MemorySection() {
  const { data: settings, mutate: mutateSettings } =
    useSWR<MemorySettingsData>("/api/user/memory/settings", fetcher);
  const { data: memoryData, mutate: mutateMemory } =
    useSWR<MemoryData>("/api/user/memory?limit=100", fetcher);

  const [isToggling, setIsToggling] = useState(false);
  const [isChangingStrategy, setIsChangingStrategy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleToggleMemory = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      await fetch("/api/user/memory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryEnabled: enabled }),
      });
      await mutateSettings();
      toast({
        type: "success",
        description: enabled
          ? "Память включена"
          : "Память отключена",
      });
    } catch {
      toast({ type: "error", description: "Не удалось обновить настройку" });
    } finally {
      setIsToggling(false);
    }
  };

  const handleStrategyChange = async (strategy: FactExtractionStrategy) => {
    setIsChangingStrategy(true);
    try {
      await fetch("/api/user/memory/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factExtractionStrategy: strategy }),
      });
      await mutateSettings();
      toast({ type: "success", description: "Стратегия обработки обновлена" });
    } catch {
      toast({ type: "error", description: "Не удалось обновить стратегию" });
    } finally {
      setIsChangingStrategy(false);
    }
  };

  const handleDeleteFact = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch("/api/user/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await Promise.all([mutateMemory(), mutateSettings()]);
      toast({ type: "success", description: "Факт удалён" });
    } catch {
      toast({ type: "error", description: "Не удалось удалить факт" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      await fetch("/api/user/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await Promise.all([mutateMemory(), mutateSettings()]);
      toast({ type: "success", description: "Вся память очищена" });
    } catch {
      toast({ type: "error", description: "Не удалось очистить память" });
    } finally {
      setIsDeletingAll(false);
    }
  };

  const facts = memoryData?.facts ?? [];
  const total = memoryData?.total ?? 0;
  const profile = memoryData?.profile ?? settings?.profile;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Память</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Simply запоминает факты из ваших разговоров, чтобы давать более
          персонализированные ответы.
        </p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="memory-toggle" className="text-sm font-medium">
            Извлечение фактов
          </Label>
          <p className="text-xs text-muted-foreground">
            AI автоматически запоминает важное из разговоров
          </p>
        </div>
        <Switch
          id="memory-toggle"
          checked={settings?.memoryEnabled ?? true}
          onCheckedChange={handleToggleMemory}
          disabled={isToggling}
        />
      </div>

      {/* Fact extraction strategy — ТЗ-MindOnVisit */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <Label className="text-sm font-medium">
            Когда обрабатывать факты для памяти
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Как Simply подхватывает факты, если они не попали в память во время
            разговора (короткие сессии).
          </p>
        </div>

        <RadioGroup
          value={settings?.factExtractionStrategy ?? "always"}
          onValueChange={(v) => handleStrategyChange(v as FactExtractionStrategy)}
          disabled={!settings?.memoryEnabled || isChangingStrategy}
          className="gap-3"
        >
          <label
            htmlFor="strategy-always"
            className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/60"
          >
            <RadioGroupItem value="always" id="strategy-always" className="mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-medium">
                🟢 Всегда актуально <span className="text-muted-foreground font-normal">(on-visit + cron)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Обработка при заходе в чат + ночная «уборка» в 3:00. Память
                всегда свежая и полная. Стоимость — средняя.
                <span className="block mt-1 text-foreground/70">Рекомендуется большинству.</span>
              </p>
            </div>
          </label>

          <label
            htmlFor="strategy-on-visit"
            className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/60"
          >
            <RadioGroupItem value="on-visit" id="strategy-on-visit" className="mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-medium">
                💰 Только при работе <span className="text-muted-foreground font-normal">(on-visit)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Обработка только когда вы сами заходите. Ночной сервер не
                работает. 0 затрат, если не пользуетесь. Если копится много
                хвостов — могут обрабатываться порциями.
                <span className="block mt-1 text-foreground/70">Для редких или нерегулярных пользователей.</span>
              </p>
            </div>
          </label>

          <label
            htmlFor="strategy-cron"
            className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/60"
          >
            <RadioGroupItem value="cron" id="strategy-cron" className="mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-medium">
                🌙 Только ночью <span className="text-muted-foreground font-normal">(cron)</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Обработка только раз в сутки в 3:00 МСК. Во время разговора —
                ничего. Дёшево и предсказуемо. Факты из сегодняшних разговоров
                попадут в память только к следующему утру.
                <span className="block mt-1 text-foreground/70">Если не нужна актуальная память в течение дня.</span>
              </p>
            </div>
          </label>
        </RadioGroup>
      </div>

      {/* Profile */}
      <div className="rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium mb-2">Профиль пользователя</h3>
        {profile ? (
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Создан:{" "}
              {new Date(profile.generatedAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p>На основе {profile.factCount} фактов</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Профиль будет создан автоматически, когда накопится достаточно фактов.
          </p>
        )}
      </div>

      {/* Stats + Delete All */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `${total} фактов в памяти` : "Память пуста"}
        </p>
        {total > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={isDeletingAll}>
                {isDeletingAll ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : null}
                Удалить всё
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить всю память?</AlertDialogTitle>
                <AlertDialogDescription>
                  Будут удалены все {total} фактов. Это действие нельзя отменить.
                  AI перестанет помнить информацию из предыдущих разговоров.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAll}>
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Facts list */}
      {facts.length > 0 && (
        <div className="space-y-2">
          {facts.map((fact) => {
            const config = CATEGORY_CONFIG[fact.category] ?? {
              label: fact.category,
              className: "bg-muted text-muted-foreground",
            };
            return (
              <div
                key={fact.id}
                className="group flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`}
                    >
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(fact.confidence * 100)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(fact.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <p className="text-sm">{fact.content}</p>
                </div>
                <button
                  onClick={() => handleDeleteFact(fact.id)}
                  disabled={deletingId === fact.id}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                  title="Удалить факт"
                >
                  {deletingId === fact.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
