"use client";

import { useState } from "react";
import type { DevPanelMessageData } from "../dev-panel-provider";

export function PromptSection({ data }: { data: DevPanelMessageData }) {
  const [expanded, setExpanded] = useState(false);
  const prompt = data.prompt;

  if (!prompt) return null;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Prompt
      </h3>

      <div className="mb-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Agent</span>
        <span className="font-medium">{prompt.activeAgent}</span>

        <span className="text-muted-foreground">Mode</span>
        <span>{prompt.chatMode}</span>

        <span className="text-muted-foreground">Project</span>
        <span>
          {prompt.isProjectChat ? "Yes" : "No"}
          {prompt.projectTier ? ` (${prompt.projectTier})` : ""}
        </span>

        <span className="text-muted-foreground">Snapshot</span>
        <span>{prompt.hasSnapshotContext ? "Yes" : "No"}</span>

        <span className="text-muted-foreground">Prompt length</span>
        <span>{prompt.systemPromptLength.toLocaleString("ru-RU")} chars</span>
      </div>

      {prompt.contextInjections.length > 0 && (
        <div className="mb-2">
          <span className="text-xs text-muted-foreground">Injections: </span>
          {prompt.contextInjections.map((inj, i) => (
            <span
              key={i}
              className="mr-1 inline-flex rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]"
            >
              {inj}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground"
      >
        {expanded
          ? "\u25BE Hide prompt preview"
          : "\u25B8 Show prompt preview"}
      </button>

      {expanded && (
        <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
          {prompt.systemPromptPreview}
          {prompt.systemPromptLength > prompt.systemPromptPreview.length &&
            "\n\n[... truncated]"}
        </pre>
      )}
    </section>
  );
}
