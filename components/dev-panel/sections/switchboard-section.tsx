"use client";

/**
 * DevPanel Switchboard Section (ТЗ-2 Stage 3).
 *
 * Quick model override switcher inside DevPanelDrawer — change the model for
 * the current task without leaving the chat page. Reuses the same Server Actions
 * from /dev/models (setOverride, clearTaskOverride).
 *
 * Hidden when data.prompt.taskId is undefined (old messages or non-chat contexts).
 */

import { useState, useTransition } from "react";
import { ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";

import type { DevPanelMessageData } from "../dev-panel-provider";
import { listAllModels } from "@/lib/ai/model-catalog";
import { ModelSelect } from "@/components/shared/model-select";
import { Button } from "@/components/ui/button";
import {
  setOverride,
  clearTaskOverride,
} from "@/app/(dashboard)/dev/models/actions";

// Catalog is static — safe to call at module level on the client.
const CATALOG = listAllModels();

export function SwitchboardSection({ data }: { data: DevPanelMessageData }) {
  const taskId = data.prompt?.taskId;
  if (!taskId) return null;

  return <SwitchboardInner taskId={taskId} data={data} />;
}

/**
 * Inner component separated so the early return above doesn't break hooks rules.
 */
function SwitchboardInner({
  taskId,
  data,
}: {
  taskId: string;
  data: DevPanelMessageData;
}) {
  const effectiveModelId =
    data.prompt?.effectiveModelId ??
    data.finish?.modelId ??
    data.steps[0]?.modelId ??
    "";
  const isOverridden = data.prompt?.overrideActive ?? false;

  const [selectedModel, setSelectedModel] = useState(effectiveModelId);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleApply = () => {
    if (!selectedModel || selectedModel === effectiveModelId) return;
    startTransition(async () => {
      await setOverride(taskId, selectedModel);
      setFeedback("Override saved — next message will use the new model");
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      await clearTaskOverride(taskId);
      const defaultId = data.prompt?.defaultModelId ?? effectiveModelId;
      setSelectedModel(defaultId);
      setFeedback("Override cleared — back to default");
      setTimeout(() => setFeedback(null), 4000);
    });
  };

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Model Switchboard
      </h3>

      <div className="flex flex-col gap-2">
        {/* Current task */}
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground">Task:</span>
          <span className="font-mono text-xs font-medium">{taskId}</span>
          {isOverridden && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-amber-700 dark:text-amber-400">
              OVERRIDE
            </span>
          )}
        </div>

        {/* Model dropdown */}
        <ModelSelect
          value={selectedModel}
          onChange={setSelectedModel}
          catalog={CATALOG}
          taskId={taskId}
          disabled={isPending}
          className="h-8 w-full font-mono text-xs"
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs"
            disabled={isPending || selectedModel === effectiveModelId}
            onClick={handleApply}
          >
            Apply
          </Button>

          {isOverridden && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              disabled={isPending}
              onClick={handleReset}
            >
              <RotateCcw className="mr-1 size-3" />
              Reset
            </Button>
          )}

          <Link
            href="/dev/models"
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Full switchboard
            <ExternalLink className="size-3" />
          </Link>
        </div>

        {/* Feedback toast-like inline message */}
        {feedback && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {feedback}
          </p>
        )}
      </div>
    </section>
  );
}
