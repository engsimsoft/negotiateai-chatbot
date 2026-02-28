"use client";

import { useState } from "react";
import type { DevPanelMessageData } from "../dev-panel-provider";

export function RawSection({ data }: { data: DevPanelMessageData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="font-mono text-xs uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground"
      >
        {expanded ? "\u25BE Raw JSON" : "\u25B8 Raw JSON"}
      </button>

      {expanded && (
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}
