"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  CheckSquare,
  Calendar,
  Scale,
  Users,
  Lightbulb,
  FileText,
  Settings,
  Loader2,
  Brain,
  ExternalLink,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextCard } from "./context-card";
import { fetcher } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  task: { label: "Задачи", icon: CheckSquare, color: "text-rose-500" },
  calendar: { label: "Календарь", icon: Calendar, color: "text-pink-500" },
  decision: { label: "Решения", icon: Scale, color: "text-blue-500" },
  person: { label: "Люди", icon: Users, color: "text-purple-500" },
  idea: { label: "Идеи", icon: Lightbulb, color: "text-amber-500" },
  fact: { label: "Заметки", icon: FileText, color: "text-green-500" },
  preference: { label: "Предпочтения", icon: Settings, color: "text-gray-500" },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategorySummary {
  category: string;
  count: number;
  preview: string[];
}

interface ContextData {
  categories: CategorySummary[];
  profile: {
    content: string;
    generatedAt: string;
    factCount: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContextPage() {
  const router = useRouter();
  const { data, isLoading } = useSWR<ContextData>(
    "/api/user/memory/context",
    fetcher,
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const categories = data?.categories ?? [];
  const profile = data?.profile ?? null;
  const totalFacts = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 lg:px-6">
      {/* Summary */}
      <div className="mb-6 flex items-center gap-3">
        <Brain className="size-6 text-primary" />
        <div>
          <p className="text-sm text-muted-foreground">
            {totalFacts > 0
              ? `Simply помнит ${totalFacts} ${formatFactsWord(totalFacts)} о вас`
              : "Simply пока ничего не знает о вас"}
          </p>
        </div>
      </div>

      {/* Cards grid */}
      {categories.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categories.map((cat) => {
            const config = CATEGORY_CONFIG[cat.category];
            if (!config) return null;
            return (
              <ContextCard
                key={cat.category}
                icon={config.icon}
                label={config.label}
                count={cat.count}
                preview={cat.preview}
                color={config.color}
                onClick={() => router.push("/simply")}
              />
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="mb-8 rounded-xl border border-dashed bg-background p-8 text-center">
          <Brain className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Начните общение в Simply — факты появятся автоматически
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => router.push("/simply")}
          >
            Открыть Simply
          </Button>
        </div>
      )}

      {/* Opus profile */}
      {profile && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Профиль
          </h2>
          <div className="rounded-xl border bg-background p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {truncateProfile(profile.content, 600)}
            </p>
            <p className="mt-3 text-xs text-muted-foreground/60">
              Обновлён{" "}
              {new Date(profile.generatedAt).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
              })}
              {" · "}
              На основе {profile.factCount}{" "}
              {formatFactsWord(profile.factCount)}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/settings")}
        >
          <Settings className="mr-1.5 size-3.5" />
          Настройки памяти
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/simply")}
        >
          <ExternalLink className="mr-1.5 size-3.5" />
          Открыть Simply
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFactsWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 19) return "фактов";
  if (mod10 === 1) return "факт";
  if (mod10 >= 2 && mod10 <= 4) return "факта";
  return "фактов";
}

function truncateProfile(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength)}...`;
}
