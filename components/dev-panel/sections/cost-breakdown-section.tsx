"use client";

/**
 * Cost Breakdown Section — DevPanel drawer section showing per-step cost.
 *
 * Key insight: AI SDK's onStepFinish reports per-step usage (each step is a
 * separate API call to Anthropic). The context grows with each step, so later
 * steps have higher input token counts. The REAL total cost is the SUM of all
 * per-step costs, not the last step's cumulative value.
 *
 * Also accounts for reasoning tokens (adaptive thinking) which are billed
 * at the output token rate but tracked separately.
 *
 * ТЗ-DEV3 Этап 3
 */

import { getStepCostRub } from "@/lib/ai/providers";
import type { DevPanelMessageData } from "../dev-panel-provider";

// ---------------------------------------------------------------------------
// Per-step cost calculation
// ---------------------------------------------------------------------------

interface StepCost {
  stepIndex: number;
  label: string;
  cost: number;
  modelId: string;
  noCacheInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  reasoningTokens: number;
}

function computePerStepCosts(data: DevPanelMessageData): StepCost[] {
  return data.steps.map((step) => {
    // ТЗ-DEV3: Uses server-calculated stepCostRub (TokenLens SSOT) with local fallback.
    const cost = getStepCostRub(step);

    // Label: tool names if present, otherwise step type
    const toolNames = step.toolCalls.map((tc) => tc.toolName);
    const label =
      toolNames.length > 0
        ? toolNames.join(" + ")
        : step.stepType === "initial"
          ? "Final response"
          : `Step ${step.stepIndex}`;

    return {
      stepIndex: step.stepIndex,
      label,
      cost,
      modelId: step.modelId,
      noCacheInputTokens: step.noCacheInputTokens,
      cacheReadTokens: step.cacheReadTokens,
      cacheWriteTokens: step.cacheWriteTokens,
      outputTokens: step.outputTokens,
      reasoningTokens: step.reasoningTokens,
    };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostBreakdownSection({ data }: { data: DevPanelMessageData }) {
  if (data.steps.length < 2 && !data.compaction?.triggered) return null;

  const stepCosts = computePerStepCosts(data);
  const totalCost = stepCosts.reduce((sum, s) => sum + s.cost, 0);
  const sorted = [...stepCosts].sort((a, b) => b.cost - a.cost);
  const maxCost = sorted[0]?.cost ?? 0;

  // Compare with the "naive" estimate from finish data
  const naiveCost = data.finish?.estimatedCostRub;
  const hasDelta = naiveCost != null && Math.abs(totalCost - naiveCost) > 0.01;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Cost Breakdown
      </h3>
      <div className="space-y-1.5 rounded-md border border-border/50 bg-muted/20 p-3">
        {sorted.map((s) => {
          const pct = totalCost > 0 ? (s.cost / totalCost) * 100 : 0;
          const barWidth = maxCost > 0 ? (s.cost / maxCost) * 100 : 0;
          return (
            <div key={s.stepIndex}>
              <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                <span className="truncate text-muted-foreground">
                  <span className="text-foreground/60">#{s.stepIndex}</span>{" "}
                  {s.label}
                </span>
                <span className="shrink-0 text-foreground">
                  &#8381;{s.cost.toFixed(2)}
                  <span className="ml-1 text-muted-foreground/60">
                    ({pct.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
                <div
                  className="h-1 rounded-full bg-foreground/20"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              {s.reasoningTokens > 0 && (
                <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">
                  +{s.reasoningTokens.toLocaleString("ru-RU")} reasoning tok
                </div>
              )}
            </div>
          );
        })}
        <div className="mt-1 border-t border-border/50 pt-1">
          <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] font-semibold">
            <span className="text-muted-foreground">Total (real)</span>
            <span className="text-foreground">&#8381;{totalCost.toFixed(2)}</span>
          </div>
          {hasDelta && (
            <div className="mt-0.5 font-mono text-[9px] text-amber-600 dark:text-amber-400">
              Server estimate &#8381;{naiveCost!.toFixed(2)} (last step
              cumulative, not per-step sum)
            </div>
          )}
        </div>
        {data.compaction?.triggered && (
          <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
            <div className="font-mono text-[10px] font-medium text-amber-600 dark:text-amber-400">
              Compaction iterations
            </div>
            {data.compaction.iterations.map((it, i) => (
              <div key={i} className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{it.type}</span>
                <span>{it.inputTokens.toLocaleString("ru-RU")} in / {it.outputTokens.toLocaleString("ru-RU")} out</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
