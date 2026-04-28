"use client";

/**
 * DevPanel Active Model Section.
 *
 * Read-only info panel: показывает task'у текущей модели + активный override
 * (если есть). Менять модель отсюда нельзя — единственное место для записи
 * override'ов это `/dev/models` (SSOT). Ссылка «Full switchboard» ведёт туда.
 */

import { ExternalLink } from "lucide-react";
import Link from "next/link";

import type { DevPanelMessageData } from "../dev-panel-provider";

export function SwitchboardSection({ data }: { data: DevPanelMessageData }) {
  const taskId = data.prompt?.taskId;
  if (!taskId) return null;

  const effectiveModelId =
    data.prompt?.effectiveModelId ??
    data.finish?.modelId ??
    data.steps[0]?.modelId ??
    "";
  const isOverridden = data.prompt?.overrideActive ?? false;
  const defaultModelId = data.prompt?.defaultModelId;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Active Model
      </h3>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Task:</span>
          <span className="font-mono text-xs font-medium">{taskId}</span>
          {isOverridden && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-700 dark:text-amber-400">
              OVERRIDE
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Model:</span>
          <span className="font-mono text-xs font-medium">{effectiveModelId || "—"}</span>
        </div>

        {isOverridden && defaultModelId && defaultModelId !== effectiveModelId && (
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground">Default:</span>
            <span className="font-mono text-xs text-muted-foreground line-through">
              {defaultModelId}
            </span>
          </div>
        )}

        <Link
          href="/dev/models"
          className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Full switchboard
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </section>
  );
}
