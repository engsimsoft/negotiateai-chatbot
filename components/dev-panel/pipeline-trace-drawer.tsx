// ТЗ-DEV2: Pipeline trace drawer — full trace details in a right sheet
// Shows: Summary, Stages (AI calls), Fetch Details, URL Verification, Errors, Raw JSON

"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import type {
  PipelineStageTrace,
  PipelineTraceSummary,
} from "@/lib/ai/pipeline-trace";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1_000) return n.toLocaleString("ru-RU");
  return String(n);
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-1.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function KV({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={warn ? "text-amber-600" : "text-foreground"}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary section
// ---------------------------------------------------------------------------

function SummarySection({ summary }: { summary: PipelineTraceSummary }) {
  return (
    <Section title="Summary">
      <div className="space-y-1 rounded-md border bg-muted/30 p-3">
        <KV label="Pipeline" value={summary.pipeline} />
        <KV label="Status" value={summary.status} warn={summary.status !== "success"} />
        <KV label="Stages" value={summary.stageCount} />
        <KV label="Tokens" value={formatTokens(summary.totalTokens)} />
        <KV label="Cost" value={`₽${summary.totalCostRub.toFixed(2)}`} />
        <KV label="Duration" value={formatDuration(summary.totalDurationMs)} />
        <KV label="Errors" value={summary.errorCount} warn={summary.errorCount > 0} />
        <KV label="Warnings" value={summary.warningCount} warn={summary.warningCount > 0} />
        {summary.urlVerification && (
          <>
            <div className="my-1 border-t border-border/50" />
            <KV label="URLs total" value={summary.urlVerification.total} />
            <KV label="Verified" value={summary.urlVerification.verified} />
            <KV label="Fabricated" value={summary.urlVerification.fabricated} warn={summary.urlVerification.fabricated > 0} />
            <KV label="Modified" value={summary.urlVerification.modified} warn={summary.urlVerification.modified > 0} />
          </>
        )}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Cost breakdown section
// ---------------------------------------------------------------------------

function CostBreakdownSection({ stages, totalCost }: { stages: PipelineStageTrace[]; totalCost: number }) {
  const costStages = stages
    .filter((s) => s.ai && s.ai.costRub > 0)
    .map((s) => ({ name: s.stage, cost: s.ai!.costRub, model: s.ai!.modelId }))
    .sort((a, b) => b.cost - a.cost);

  if (costStages.length === 0) return null;

  const maxCost = costStages[0].cost;

  return (
    <Section title="Cost Breakdown">
      <div className="space-y-1.5 rounded-md border bg-muted/30 p-3">
        {costStages.map((s, i) => {
          const pct = totalCost > 0 ? (s.cost / totalCost) * 100 : 0;
          const barWidth = maxCost > 0 ? (s.cost / maxCost) * 100 : 0;
          return (
            <div key={`${s.name}-${i}`}>
              <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                <span className="text-muted-foreground truncate">{s.name}</span>
                <span className="shrink-0 text-foreground">
                  ₽{s.cost.toFixed(2)}
                  <span className="ml-1 text-muted-foreground/60">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
                <div
                  className="h-1 rounded-full bg-foreground/20"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">{s.model}</div>
            </div>
          );
        })}
        <div className="mt-1 border-t border-border/50 pt-1">
          <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] font-semibold">
            <span className="text-muted-foreground">Total</span>
            <span className="text-foreground">₽{totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Stages section (AI calls per stage)
// ---------------------------------------------------------------------------

function StagesSection({ stages }: { stages: PipelineStageTrace[] }) {
  if (stages.length === 0) return null;

  return (
    <Section title={`Stages (${stages.length})`}>
      <div className="space-y-2">
        {stages.map((stage, i) => (
          <div key={`${stage.stage}-${i}`} className="rounded-md border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold">{stage.stage}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatDuration(stage.durationMs)}
              </span>
            </div>
            {stage.ai && (
              <div className="space-y-0.5">
                <KV label="Model" value={stage.ai.modelId} />
                <KV label="Tokens" value={`${formatTokens(stage.ai.promptTokens)} in / ${formatTokens(stage.ai.completionTokens)} out`} />
                <KV label="Cost" value={`₽${stage.ai.costRub.toFixed(2)}`} />
                {stage.ai.retryCount > 0 && (
                  <KV label="Retries" value={stage.ai.retryCount} warn />
                )}
                {stage.ai.fallbackUsed && (
                  <KV label="Fallback" value={stage.ai.fallbackUsed} warn />
                )}
                {stage.ai.error && (
                  <KV label="Error" value={stage.ai.error} warn />
                )}
              </div>
            )}
            {stage.dataFlow && (
              <div className="mt-1 space-y-0.5">
                <KV label="Data flow" value={`${stage.dataFlow.inputCount} → ${stage.dataFlow.outputCount} (−${stage.dataFlow.droppedCount})`} />
              </div>
            )}
            {stage.errors.length > 0 && (
              <div className="mt-1.5">
                {stage.errors.map((err, j) => (
                  <p key={j} className="font-mono text-[10px] text-destructive">{err}</p>
                ))}
              </div>
            )}
            {stage.warnings.length > 0 && (
              <div className="mt-1">
                {stage.warnings.map((w, j) => (
                  <p key={j} className="font-mono text-[10px] text-amber-600">{w}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Fetch details section
// ---------------------------------------------------------------------------

function FetchSection({ stages }: { stages: PipelineStageTrace[] }) {
  const allFetches = stages.flatMap((s) => s.fetches ?? []);
  if (allFetches.length === 0) return null;

  return (
    <Section title={`Fetches (${allFetches.length})`} defaultOpen={false}>
      <div className="space-y-1.5">
        {allFetches.map((f, i) => (
          <div key={i} className="rounded-md border bg-muted/30 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">{f.method}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{formatDuration(f.durationMs)}</span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[10px] text-foreground">{f.url}</p>
            <div className="mt-0.5 flex gap-3 font-mono text-[10px] text-muted-foreground">
              <span>{f.itemsExtracted} items</span>
              {f.statusCode && <span>HTTP {f.statusCode}</span>}
              {f.error && <span className="text-destructive">{f.error}</span>}
            </div>
            {f.warnings.length > 0 && (
              <div className="mt-0.5">
                {f.warnings.slice(0, 3).map((w, j) => (
                  <p key={j} className="font-mono text-[10px] text-amber-600 truncate">{w}</p>
                ))}
                {f.warnings.length > 3 && (
                  <p className="font-mono text-[10px] text-muted-foreground">+{f.warnings.length - 3} more</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Raw JSON section
// ---------------------------------------------------------------------------

function RawSection({ stages, summary }: { stages: PipelineStageTrace[]; summary: PipelineTraceSummary | null }) {
  return (
    <Section title="Raw JSON" defaultOpen={false}>
      <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
        {JSON.stringify({ summary, stages }, null, 2)}
      </pre>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Main drawer
// ---------------------------------------------------------------------------

export function PipelineTraceDrawer({
  open,
  onOpenChange,
  stages,
  summary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: PipelineStageTrace[];
  summary: PipelineTraceSummary | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:w-[440px]">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">Pipeline Trace</SheetTitle>
          <SheetDescription className="sr-only">
            Detailed trace information for this pipeline run
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-4">
          {summary && <SummarySection summary={summary} />}
          <CostBreakdownSection stages={stages} totalCost={summary?.totalCostRub ?? stages.reduce((sum, s) => sum + (s.ai?.costRub ?? 0), 0)} />
          <StagesSection stages={stages} />
          <FetchSection stages={stages} />
          <RawSection stages={stages} summary={summary} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
