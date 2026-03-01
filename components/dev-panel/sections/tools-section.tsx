"use client";

/**
 * Tools Section — DevPanel drawer section showing detailed tool call info.
 *
 * Structured display per tool type:
 * - deepResearch: query, depth, citation count
 * - fetchUrl: URL, source method, RSS status, content length
 * - readTelegramChannel: handle, isValid, post count
 * - updateBriefingPreview: topic/source count
 *
 * Warnings: client-side detection of source issues.
 *
 * ТЗ-DEV3 Этап 2
 */

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { DebugStepData, DebugGuardianData } from "@/lib/ai/debug-events";
import type { DevPanelMessageData } from "../dev-panel-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolCallEntry {
  stepIndex: number;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  durationMs?: number;
  warnings: Warning[];
}

interface Warning {
  level: "warn" | "info";
  text: string;
}

// ---------------------------------------------------------------------------
// Extract tool calls from steps
// ---------------------------------------------------------------------------

function extractToolCalls(data: DevPanelMessageData): ToolCallEntry[] {
  const entries: ToolCallEntry[] = [];

  // Collect ALL tool results across all steps into a queue per toolName.
  // Tool calls and their results often land in different steps:
  // Step N has toolCalls (finishReason: tool-calls),
  // Step N+1 has toolResults (stepType: tool-result).
  const resultQueues = new Map<string, unknown[]>();
  for (const step of data.steps) {
    for (const tr of step.toolResults) {
      const q = resultQueues.get(tr.toolName) ?? [];
      q.push(tr.result);
      resultQueues.set(tr.toolName, q);
    }
  }

  // Track consumption index per toolName
  const consumed = new Map<string, number>();

  for (const step of data.steps) {
    for (const tc of step.toolCalls) {
      const guardian = data.guardians.find(
        (g) => g.stepIndex === step.stepIndex,
      );

      // Pop next result for this toolName
      const idx = consumed.get(tc.toolName) ?? 0;
      const queue = resultQueues.get(tc.toolName);
      const result = queue?.[idx];
      consumed.set(tc.toolName, idx + 1);

      const entry: ToolCallEntry = {
        stepIndex: step.stepIndex,
        toolName: tc.toolName,
        args: tc.args,
        result,
        durationMs: guardian?.durationMs,
        warnings: [],
      };

      entry.warnings = detectWarnings(entry, data.guardians);
      entries.push(entry);
    }
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Warning detection
// ---------------------------------------------------------------------------

function detectWarnings(
  entry: ToolCallEntry,
  guardians: DebugGuardianData[],
): Warning[] {
  const warnings: Warning[] = [];
  const r = entry.result as Record<string, unknown> | null | undefined;

  if (!entry.result && entry.result !== false) {
    warnings.push({ level: "warn", text: "Нет результата" });
    return warnings;
  }

  switch (entry.toolName) {
    case "fetchUrl": {
      if (!r) break;
      const content = r.content as string | undefined;
      const error = r.error as string | undefined;
      const rssUrl = r.rssUrl as string | undefined;
      const url = (entry.args?.url as string) ?? "";
      const isTelegram = url.includes("t.me/") || url.includes("telegram");

      if (error || !content) {
        warnings.push({ level: "warn", text: "Контент не прочитан" });
      }
      if (rssUrl) {
        warnings.push({ level: "info", text: "RSS найден" });
      } else if (!isTelegram && !error) {
        warnings.push({ level: "warn", text: "RSS не обнаружен" });
      }
      break;
    }
    case "readTelegramChannel": {
      if (!r) break;
      const isValid = r.isValid as boolean | undefined;
      const postCount = r.postCount as number | undefined;

      if (isValid === false) {
        warnings.push({ level: "warn", text: "Канал недоступен" });
      }
      if (typeof postCount === "number" && postCount < 3) {
        warnings.push({
          level: "warn",
          text: `Мало постов (${postCount})`,
        });
      }
      break;
    }
  }

  // Guardian detection for any tool
  for (const g of guardians) {
    if (g.stepIndex === entry.stepIndex && g.detected) {
      warnings.push({ level: "warn", text: "Упомянут без вызова" });
      break;
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function buildSummary(entries: ToolCallEntry[]): string {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.toolName, (counts.get(e.toolName) ?? 0) + 1);
  }
  const parts = Array.from(counts.entries()).map(
    ([name, count]) => (count > 1 ? `${name} \u00d7${count}` : name),
  );
  return `${entries.length} calls: ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Structured renderers per tool type
// ---------------------------------------------------------------------------

const DEPTH_LABELS: Record<string, string> = {
  pro: "Pro (Sonar Pro)",
  deep: "Deep Research",
};

function DeepResearchDisplay({ args, result }: { args: Record<string, unknown>; result: unknown }) {
  const r = result as Record<string, unknown> | null;
  // depth may be in result (always set) or args (only if model passed it explicitly)
  const depth = String(r?.depth ?? args?.depth ?? "pro");
  return (
    <div className="flex flex-col gap-1 text-[11px]">
      <Row label="Query" value={args?.query as string} />
      <Row label="Режим" value={DEPTH_LABELS[depth] ?? depth} />
      {r?.citationsCount != null ? (
        <Row label="Citations" value={String(r.citationsCount)} />
      ) : r?.citationCount != null ? (
        <Row label="Citations" value={String(r.citationCount)} />
      ) : null}
      {Array.isArray(r?.citations) ? (
        <div className="mt-1">
          <span className="text-muted-foreground">URLs:</span>
          <ul className="ml-3 list-disc">
            {(r!.citations as Array<string | { url?: string; title?: string }>).slice(0, 3).map((c, i) => {
              const href = typeof c === "string" ? c : c.url ?? "";
              return (
                <li key={i} className="truncate text-[10px] text-muted-foreground/70">
                  {href}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function FetchUrlDisplay({ args, result }: { args: Record<string, unknown>; result: unknown }) {
  const r = result as Record<string, unknown> | null;
  const content = r?.content as string | undefined;
  const title = r?.title != null ? String(r.title) : undefined;
  const fetchMethod = r?.source ?? r?.fetchMethod;
  const rssUrl = r?.rssUrl != null ? String(r.rssUrl) : undefined;
  return (
    <div className="flex flex-col gap-1 text-[11px]">
      <Row label="URL" value={args?.url as string} truncate />
      {title ? <Row label="Title" value={title} /> : null}
      {fetchMethod ? <Row label="Method" value={String(fetchMethod)} /> : null}
      {rssUrl ? <Row label="RSS" value={rssUrl} truncate /> : null}
      {content ? (
        <Row label="Content" value={`${content.length} chars`} />
      ) : null}
    </div>
  );
}

function TelegramDisplay({ args, result }: { args: Record<string, unknown>; result: unknown }) {
  const r = result as Record<string, unknown> | null;
  return (
    <div className="flex flex-col gap-1 text-[11px]">
      <Row label="Channel" value={(args?.channelUrl ?? args?.handle ?? args?.channel ?? args?.url) as string} />
      {r?.isValid != null && (
        <Row label="Valid" value={r.isValid ? "\u2713" : "\u2717"} />
      )}
      {(r?.totalFetched ?? r?.postCount) != null ? (
        <Row label="Posts" value={String(r?.totalFetched ?? r?.postCount)} />
      ) : null}
    </div>
  );
}

function PreviewDisplay({ result }: { result: unknown }) {
  const r = result as Record<string, unknown> | null;
  const preview = (r?.preview ?? r) as Record<string, unknown> | null;
  if (!preview) return null;

  const topics = preview.topics as Array<{ emoji?: string; topicName?: string }> | undefined;
  const sources = preview.sources as unknown[] | undefined;

  return (
    <div className="flex flex-col gap-1 text-[11px]">
      {topics && (
        <Row
          label="Topics"
          value={`${topics.length}: ${topics.map((t) => `${t.emoji ?? ""} ${t.topicName ?? ""}`).join(", ")}`}
        />
      )}
      {sources && <Row label="Sources" value={String(sources.length)} />}
    </div>
  );
}

function GenericDisplay({ args, result }: { args: Record<string, unknown>; result: unknown }) {
  return (
    <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
      {JSON.stringify({ args, result }, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function Row({ label, value, truncate }: { label: string; value?: string; truncate?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className={`font-mono text-foreground/80 ${truncate ? "truncate" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function WarningBadge({ warning }: { warning: Warning }) {
  if (warning.level === "info") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
        {"\u2713"} {warning.text}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
      {"\u26a0"} {warning.text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Tool call card
// ---------------------------------------------------------------------------

function ToolCallCard({ entry }: { entry: ToolCallEntry }) {
  const [open, setOpen] = useState(false);

  const structuredRenderer = (() => {
    switch (entry.toolName) {
      case "deepResearch":
        return <DeepResearchDisplay args={entry.args} result={entry.result} />;
      case "fetchUrl":
        return <FetchUrlDisplay args={entry.args} result={entry.result} />;
      case "readTelegramChannel":
        return <TelegramDisplay args={entry.args} result={entry.result} />;
      case "updateBriefingPreview":
        return <PreviewDisplay result={entry.result} />;
      default:
        return null;
    }
  })();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40"
        >
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-primary">
              {entry.toolName}
            </span>
            {entry.warnings.length > 0 && (
              <span className="flex gap-1">
                {entry.warnings.map((w, i) => (
                  <WarningBadge key={i} warning={w} />
                ))}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            {entry.durationMs != null && (
              <span className="text-[10px]">
                {entry.durationMs < 1000
                  ? `${entry.durationMs}ms`
                  : `${(entry.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
            <span className="text-[10px]">{open ? "\u25BE" : "\u25B8"}</span>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-3 border-l border-border/30 pl-3 pt-2 pb-1">
          {structuredRenderer ?? (
            <GenericDisplay args={entry.args} result={entry.result} />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ToolsSection({ data }: { data: DevPanelMessageData }) {
  const entries = extractToolCalls(data);
  if (entries.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tools
      </h3>
      <p className="mb-3 text-[11px] text-muted-foreground/70">
        {buildSummary(entries)}
      </p>
      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <ToolCallCard key={i} entry={entry} />
        ))}
      </div>
    </section>
  );
}
