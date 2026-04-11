"use client";

import { useState } from "react";

import type {
  DebugErrorData,
  DebugWarningData,
} from "@/lib/ai/debug-events";
import type { DevPanelMessageData } from "../dev-panel-provider";

/**
 * ТЗ-DevPanelErrors: Errors & Warnings section for DevPanel drawer.
 *
 * Lists per-message errors (red) and warnings (yellow) with source, message,
 * timestamp, and collapsible stack + context. Empty state hidden by parent.
 */

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EntryRow({
  kind,
  source,
  message,
  timestamp,
  stack,
  context,
}: {
  kind: "error" | "warning";
  source: string;
  message: string;
  timestamp: number;
  stack?: string;
  context?: Record<string, unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = !!stack || !!context;

  const color =
    kind === "error"
      ? "border-destructive/40 bg-destructive/5"
      : "border-yellow-500/40 bg-yellow-500/5";
  const iconColor =
    kind === "error"
      ? "text-destructive"
      : "text-yellow-600 dark:text-yellow-400";
  const icon = kind === "error" ? "\u25CF" : "\u26A0";

  return (
    <div className={`rounded-md border ${color} px-3 py-2 text-xs`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className={`${iconColor} mt-0.5 font-mono`}>{icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <code className="rounded bg-muted/40 px-1 py-0.5 text-[10px] text-muted-foreground">
                {source}
              </code>
              <span className="text-muted-foreground">
                {formatTime(timestamp)}
              </span>
            </div>
            <div className="mt-1 break-words font-medium">{message}</div>
          </div>
        </div>
        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? "\u25BE" : "\u25B8"}
          </button>
        )}
      </div>
      {expanded && hasDetails && (
        <div className="mt-2 space-y-2">
          {stack && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Stack
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[10px] leading-snug">
                {stack}
              </pre>
            </div>
          )}
          {context && Object.keys(context).length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                Context
              </div>
              <pre className="max-h-40 overflow-auto rounded bg-muted/40 p-2 text-[10px] leading-snug">
                {JSON.stringify(context, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ErrorsSection({ data }: { data: DevPanelMessageData }) {
  const { errors, warnings } = data;
  const total = errors.length + warnings.length;
  if (total === 0) return null;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Errors & Warnings
        <span className="ml-2 text-muted-foreground/60">
          ({errors.length}E / {warnings.length}W)
        </span>
      </h3>
      <div className="flex flex-col gap-2">
        {errors.map((e: DebugErrorData, i: number) => (
          <EntryRow
            key={`e-${i}`}
            kind="error"
            source={e.source}
            message={e.message}
            timestamp={e.timestamp}
            stack={e.stack}
            context={e.context}
          />
        ))}
        {warnings.map((w: DebugWarningData, i: number) => (
          <EntryRow
            key={`w-${i}`}
            kind="warning"
            source={w.source}
            message={w.message}
            timestamp={w.timestamp}
            context={w.context}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Variant that accepts raw arrays, used by global session errors drawer
 * where there's no DevPanelMessageData wrapper.
 */
export function ErrorsList({
  errors,
  warnings,
}: {
  errors: DebugErrorData[];
  warnings?: DebugWarningData[];
}) {
  const total = errors.length + (warnings?.length ?? 0);
  if (total === 0) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
        Ошибок и предупреждений нет
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {errors.map((e, i) => (
        <EntryRow
          key={`e-${i}`}
          kind="error"
          source={e.source}
          message={e.message}
          timestamp={e.timestamp}
          stack={e.stack}
          context={e.context}
        />
      ))}
      {(warnings ?? []).map((w, i) => (
        <EntryRow
          key={`w-${i}`}
          kind="warning"
          source={w.source}
          message={w.message}
          timestamp={w.timestamp}
          context={w.context}
        />
      ))}
    </div>
  );
}
