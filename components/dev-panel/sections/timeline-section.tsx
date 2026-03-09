"use client";

import { useState } from "react";
import type { DebugStepData, DebugGuardianData } from "@/lib/ai/debug-events";
import type { DevPanelMessageData } from "../dev-panel-provider";

const MODEL_SHORT: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku",
  "claude-sonnet-4-6": "Sonnet",
  "claude-opus-4-6": "Opus",
};

export function TimelineSection({ data }: { data: DevPanelMessageData }) {
  if (data.steps.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Timeline
      </h3>
      <div className="flex flex-col gap-2">
        {data.steps.map((step, i) => (
          <StepCard
            key={i}
            step={step}
            guardian={data.guardians[i]}
          />
        ))}
      </div>
    </section>
  );
}

function StepCard({
  step,
  guardian,
}: {
  step: DebugStepData;
  guardian?: DebugGuardianData;
}) {
  const [expanded, setExpanded] = useState(false);
  const modelShort = MODEL_SHORT[step.modelId] ?? step.modelId;
  const durationMs = guardian?.durationMs;
  const hasDetails = step.toolCalls.length > 0 || step.toolResults.length > 0;

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono font-medium">Step {step.stepIndex}</span>
          <span className="text-muted-foreground">{step.stepType}</span>
          <span className="text-muted-foreground/60">{modelShort}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{step.inputTokens + step.outputTokens + (step.reasoningTokens ?? 0)} tok</span>
          {durationMs != null && (
            <span>
              {durationMs < 1000
                ? `${durationMs}ms`
                : `${(durationMs / 1000).toFixed(1)}s`}
            </span>
          )}
          <span className="font-mono text-[10px]">{step.finishReason}</span>
        </div>
      </div>

      {step.toolCalls.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {step.toolCalls.map((tc, j) => (
            <span
              key={j}
              className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
            >
              {tc.toolName}
            </span>
          ))}
        </div>
      )}

      {hasDetails && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
        >
          {expanded ? "\u25BE Hide details" : "\u25B8 Show details"}
        </button>
      )}

      {expanded && (
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
          {JSON.stringify(
            { toolCalls: step.toolCalls, toolResults: step.toolResults },
            null,
            2,
          )}
        </pre>
      )}
    </div>
  );
}
