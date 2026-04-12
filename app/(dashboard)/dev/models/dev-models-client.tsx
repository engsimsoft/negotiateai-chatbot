"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  Eye,
  FileText,
  Layers,
  Loader2,
  RotateCcw,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";

import type {
  DevModelsPageData,
  ProviderEnvStatus,
  TaskRow,
} from "./page";
import type { ModelCapabilities, ModelEntry } from "@/lib/ai/model-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserMenu } from "@/components/user-menu";
import {
  ModelSelect,
  taskRequiresCapability,
} from "@/components/shared/model-select";

import {
  clearTaskOverride,
  resetAllOverrides,
  setOverride,
} from "./actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RUB_PER_USD = 100;

/** 1M USD vendor price → RUB per 1K tokens (display friendly). */
function rubPer1k(usdPer1m: number): string {
  const rub = (usdPer1m * RUB_PER_USD) / 1000;
  if (rub === 0) return "—";
  if (rub < 0.01) return rub.toFixed(4);
  return rub.toFixed(2);
}

function shortenCatalogId(id: string): string {
  // "claude-haiku-4-5-20251001" → "claude-haiku-4-5"
  return id.replace(/-\d{8}$/, "");
}

// ---------------------------------------------------------------------------
// Capability badges
// ---------------------------------------------------------------------------

interface CapabilityConfig {
  key: keyof ModelCapabilities;
  label: string;
  icon: typeof Sparkles;
}

const CAPABILITIES: CapabilityConfig[] = [
  { key: "vision",    label: "vision",    icon: Eye },
  { key: "tools",     label: "tools",     icon: Wrench },
  { key: "thinking",  label: "thinking",  icon: Sparkles },
  { key: "streaming", label: "streaming", icon: Zap },
  { key: "documents", label: "docs",      icon: FileText },
  { key: "embeddings",label: "embed",     icon: Layers },
];

function CapabilityBadges({ caps }: { caps: ModelCapabilities }) {
  return (
    <div className="flex gap-1">
      {CAPABILITIES.map((cap) => {
        const Icon = cap.icon;
        const enabled = caps[cap.key];
        return (
          <Tooltip key={cap.key}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex size-4 items-center justify-center ${
                  enabled ? "text-foreground" : "text-muted-foreground/30"
                }`}
              >
                <Icon className="size-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {cap.label}: {enabled ? "yes" : "no"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider card
// ---------------------------------------------------------------------------

function ProviderCard({ provider }: { provider: ProviderEnvStatus }) {
  return (
    <Card className="flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium">
          {provider.provider}
        </span>
        <Badge variant={provider.hasKey ? "default" : "destructive"}>
          {provider.hasKey ? "✅ set" : "❌ missing"}
        </Badge>
      </div>
      <div className="font-mono text-xs text-muted-foreground">
        {provider.envVar}
      </div>
      {provider.hasKey && provider.last4 && (
        <div className="font-mono text-xs text-muted-foreground">
          …{provider.last4}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

function TaskRowItem({
  row,
  catalog,
  onSet,
  onClear,
  isPending,
}: {
  row: TaskRow;
  catalog: ModelEntry[];
  onSet: (taskId: string, catalogId: string) => void;
  onClear: (taskId: string) => void;
  isPending: boolean;
}) {
  const effectiveEntry = catalog.find((e) => e.id === row.effectiveCatalogId);
  const compat = effectiveEntry
    ? taskRequiresCapability(row.taskId, effectiveEntry.capabilities)
    : { ok: true };

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30">
      <td className="px-2 py-1.5 font-mono text-xs">{row.taskId}</td>
      <td className="px-2 py-1.5 font-mono text-xs text-muted-foreground">
        {shortenCatalogId(row.defaultCatalogId)}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-2">
          <ModelSelect
            value={row.effectiveCatalogId}
            onChange={(catalogId) => onSet(row.taskId, catalogId)}
            catalog={catalog}
            taskId={row.taskId}
            disabled={isPending}
          />
          {!compat.ok && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              </TooltipTrigger>
              <TooltipContent>{compat.reason}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      <td className="px-2 py-1.5">
        {effectiveEntry && <CapabilityBadges caps={effectiveEntry.capabilities} />}
      </td>
      <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
        {effectiveEntry
          ? `${rubPer1k(effectiveEntry.pricing.input)} / ${rubPer1k(effectiveEntry.pricing.output)} ₽/1K`
          : "—"}
      </td>
      <td className="px-2 py-1.5 text-right">
        {row.hasOverride ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={isPending}
            onClick={() => onClear(row.taskId)}
          >
            reset
          </Button>
        ) : (
          <span className="px-2 text-xs text-muted-foreground/50">default</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function DevModelsClient({ data }: { data: DevModelsPageData }) {
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const llmProviders = data.providers.filter((p) => p.isLlmRegistry);
  const rawProviders = data.providers.filter((p) => !p.isLlmRegistry);

  const filteredTasks = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return data.tasks;
    return data.tasks.filter(
      (t) =>
        t.taskId.toLowerCase().includes(q) ||
        t.defaultCatalogId.toLowerCase().includes(q) ||
        t.effectiveCatalogId.toLowerCase().includes(q),
    );
  }, [filter, data.tasks]);

  const handleSet = (taskId: string, catalogId: string) => {
    // Remember previous value for undo
    const prev = data.tasks.find((t) => t.taskId === taskId);
    const prevCatalogId = prev?.effectiveCatalogId;

    startTransition(async () => {
      await setOverride(taskId, catalogId);
      toast(`Override: ${taskId} → ${catalogId}`, {
        action: prevCatalogId
          ? {
              label: "Undo",
              onClick: () => {
                startTransition(async () => {
                  if (prev?.hasOverride) {
                    await setOverride(taskId, prevCatalogId);
                  } else {
                    await clearTaskOverride(taskId);
                  }
                });
              },
            }
          : undefined,
        duration: 5000,
      });
    });
  };

  const handleClear = (taskId: string) => {
    const prev = data.tasks.find((t) => t.taskId === taskId);
    const prevCatalogId = prev?.effectiveCatalogId;

    startTransition(async () => {
      await clearTaskOverride(taskId);
      toast(`Reset: ${taskId} → default`, {
        action: prevCatalogId
          ? {
              label: "Undo",
              onClick: () => {
                startTransition(async () => {
                  await setOverride(taskId, prevCatalogId);
                });
              },
            }
          : undefined,
        duration: 5000,
      });
    });
  };

  const handleResetAll = () => {
    if (!confirm("Reset ALL overrides?")) return;
    startTransition(async () => {
      await resetAllOverrides();
      toast("All overrides cleared");
    });
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex min-h-svh flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border bg-background px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              Dashboard
            </Link>
            <div className="h-4 w-px bg-border" />
            <h1 className="font-mono text-sm font-medium">Dev · Models</h1>
            {data.overrideCount > 0 && (
              <Badge variant="default" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                {data.overrideCount} override{data.overrideCount === 1 ? "" : "s"} active
              </Badge>
            )}
            {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetAll}
              disabled={isPending || data.overrideCount === 0}
              className="h-8 text-xs"
            >
              <RotateCcw className="mr-1 size-3" />
              Reset all
            </Button>
            <UserMenu align="end" />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-6 overflow-auto px-4 py-6">
          {/* LLM Providers */}
          <section>
            <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              LLM Providers ({llmProviders.length})
            </h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {llmProviders.map((p) => (
                <ProviderCard key={p.provider} provider={p} />
              ))}
            </div>
          </section>

          {/* Raw Providers */}
          <section>
            <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Raw Providers ({rawProviders.length})
            </h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {rawProviders.map((p) => (
                <ProviderCard key={p.provider} provider={p} />
              ))}
            </div>
          </section>

          {/* Task assignments */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Task Assignments ({data.tasks.length})
              </h2>
              <Input
                placeholder="filter taskId or model…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-8 max-w-xs text-xs"
              />
            </div>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Task</th>
                      <th className="px-2 py-2 text-left font-medium">Default</th>
                      <th className="px-2 py-2 text-left font-medium">Active Model</th>
                      <th className="px-2 py-2 text-left font-medium">Caps</th>
                      <th className="px-2 py-2 text-left font-medium">Price (in/out)</th>
                      <th className="px-2 py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((row) => (
                      <TaskRowItem
                        key={row.taskId}
                        row={row}
                        catalog={data.catalog}
                        onSet={handleSet}
                        onClear={handleClear}
                        isPending={isPending}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            {filteredTasks.length === 0 && (
              <div className="mt-2 text-center text-xs text-muted-foreground">
                No tasks match filter
              </div>
            )}
          </section>

          {/* Catalog */}
          <section>
            <h2 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Model Catalog ({data.catalog.length} entries, {data.physicalCatalog.length} physical)
            </h2>
            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 uppercase text-muted-foreground">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">Catalog ID</th>
                      <th className="px-2 py-2 text-left font-medium">Provider</th>
                      <th className="px-2 py-2 text-left font-medium">Physical</th>
                      <th className="px-2 py-2 text-left font-medium">Caps</th>
                      <th className="px-2 py-2 text-left font-medium">Ctx</th>
                      <th className="px-2 py-2 text-left font-medium">In $/1M</th>
                      <th className="px-2 py-2 text-left font-medium">Out $/1M</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.catalog.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/50">
                        <td className="px-2 py-1.5 font-mono">{entry.id}</td>
                        <td className="px-2 py-1.5">{entry.provider}</td>
                        <td className="px-2 py-1.5 font-mono text-muted-foreground">
                          {entry.aliasOf ?? entry.modelId}
                        </td>
                        <td className="px-2 py-1.5">
                          <CapabilityBadges caps={entry.capabilities} />
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                          {entry.contextWindow
                            ? `${(entry.contextWindow / 1000).toFixed(0)}K`
                            : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ${entry.pricing.input}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          ${entry.pricing.output}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <footer className="pt-4 text-center text-xs text-muted-foreground">
            ТЗ-2 Dev Switchboard · SSOT file: <code className="font-mono">.simply-dev-overrides.json</code>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
