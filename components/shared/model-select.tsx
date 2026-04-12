"use client";

/**
 * Shared Model Select dropdown (ТЗ-2 Stage 3).
 *
 * Used by:
 *  - /dev/models page (full task-assignment table)
 *  - DevPanel switchboard section (per-message quick switcher)
 *
 * Groups catalog entries by provider, shows compatibility warnings
 * when a model's capabilities don't match the task requirements.
 */

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";

import type { ModelCapabilities, ModelEntry } from "@/lib/ai/model-catalog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ---------------------------------------------------------------------------
// Compatibility heuristic
// ---------------------------------------------------------------------------

export function taskRequiresCapability(
  taskId: string,
  caps: ModelCapabilities,
): { ok: boolean; reason?: string } {
  if (taskId.includes("vision") && !caps.vision) {
    return { ok: false, reason: "task handles images — model lacks vision" };
  }
  if (taskId.startsWith("embed:") && !caps.embeddings) {
    return { ok: false, reason: "task needs embeddings" };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ModelSelect
// ---------------------------------------------------------------------------

export function ModelSelect({
  value,
  onChange,
  catalog,
  taskId,
  disabled,
  className,
}: {
  value: string;
  onChange: (catalogId: string) => void;
  catalog: ModelEntry[];
  taskId: string;
  disabled?: boolean;
  className?: string;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, ModelEntry[]>();
    for (const entry of catalog) {
      const list = map.get(entry.provider) ?? [];
      list.push(entry);
      map.set(entry.provider, list);
    }
    return Array.from(map.entries());
  }, [catalog]);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={
          className ?? "h-8 w-full max-w-[300px] font-mono text-xs"
        }
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[360px]">
        {grouped.map(([providerId, entries]) => (
          <div key={providerId}>
            <div className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">
              {providerId}
            </div>
            {entries.map((entry) => {
              const compat = taskRequiresCapability(taskId, entry.capabilities);
              return (
                <SelectItem
                  key={entry.id}
                  value={entry.id}
                  className="font-mono text-xs"
                >
                  <span className="flex items-center gap-2">
                    {!compat.ok && (
                      <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>{entry.id}</span>
                    {entry.aliasOf && (
                      <span className="text-muted-foreground/60">
                        → {entry.aliasOf}
                      </span>
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}
