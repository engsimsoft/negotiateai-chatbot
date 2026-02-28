"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useDataStream } from "@/components/data-stream-provider";
import type {
  DebugStepData,
  DebugFinishData,
  DebugGuardianData,
  DebugPromptData,
} from "@/lib/ai/debug-events";
import type { ChatMessage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevPanelMessageData {
  prompt?: DebugPromptData;
  steps: DebugStepData[];
  guardians: DebugGuardianData[];
  finish?: DebugFinishData;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DevPanelContext = createContext<Map<string, DevPanelMessageData>>(
  new Map(),
);

// ---------------------------------------------------------------------------
// Client-side gate: mirrors server-side isSimplyDevMode.
// Exposed via next.config.ts env mapping.
// ---------------------------------------------------------------------------

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DevPanelProvider({
  messages,
  children,
}: {
  messages: ChatMessage[];
  children: ReactNode;
}) {
  const { dataStream } = useDataStream();

  const debugDataMap = useMemo(() => {
    // Skip all processing in production — no debug events will ever arrive
    if (!IS_DEV_MODE) return new Map<string, DevPanelMessageData>();

    const debugEvents = dataStream.filter((e) =>
      e.type.startsWith("data-debug-"),
    );
    if (debugEvents.length === 0) return new Map<string, DevPanelMessageData>();

    // Group events into sequential batches (prompt → steps/guardians → finish)
    const batches: DevPanelMessageData[] = [];
    let current: DevPanelMessageData | null = null;

    for (const event of debugEvents) {
      const d = event.data as Record<string, unknown>;
      switch (event.type) {
        case "data-debug-prompt":
          if (current) batches.push(current);
          current = {
            prompt: d as unknown as DebugPromptData,
            steps: [],
            guardians: [],
          };
          break;
        case "data-debug-step":
          if (current) current.steps.push(d as unknown as DebugStepData);
          break;
        case "data-debug-guardian":
          if (current)
            current.guardians.push(d as unknown as DebugGuardianData);
          break;
        case "data-debug-finish":
          if (current) {
            current.finish = d as unknown as DebugFinishData;
            batches.push(current);
            current = null;
          }
          break;
      }
    }
    // Still-streaming batch (no finish yet)
    if (current) batches.push(current);

    // Match batches to the LATEST assistant messages (debug events only exist
    // for messages generated in the current session, not historical ones)
    const assistantMessages = messages.filter((m) => m.role === "assistant");
    const map = new Map<string, DevPanelMessageData>();
    const offset = assistantMessages.length - batches.length;
    for (
      let i = 0;
      i < Math.min(batches.length, assistantMessages.length);
      i++
    ) {
      map.set(assistantMessages[offset + i].id, batches[i]);
    }

    return map;
  }, [dataStream, messages]);

  return (
    <DevPanelContext.Provider value={debugDataMap}>
      {children}
    </DevPanelContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDevPanel(
  messageId: string,
): DevPanelMessageData | undefined {
  const map = useContext(DevPanelContext);
  return map.get(messageId);
}
