"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
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

export const DevPanelContext = createContext<Map<string, DevPanelMessageData>>(
  new Map(),
);

// ---------------------------------------------------------------------------
// Client-side gate: mirrors server-side isSimplyDevMode.
// Exposed via next.config.ts env mapping.
// ---------------------------------------------------------------------------

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";

// ---------------------------------------------------------------------------
// localStorage helpers (persistence across page reloads)
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "simply-dev-chat-debug:";

function storageKey(chatId: string): string {
  return `${STORAGE_PREFIX}${chatId}`;
}

function saveToStorage(
  chatId: string,
  map: Map<string, DevPanelMessageData>,
): void {
  try {
    // Only persist entries that have a finish (completed responses)
    const entries = Array.from(map.entries()).filter(([, v]) => !!v.finish);
    if (entries.length === 0) return;
    localStorage.setItem(storageKey(chatId), JSON.stringify(entries));
  } catch {
    // Silently fail (quota, SSR, etc.)
  }
}

function loadFromStorage(
  chatId: string,
): Map<string, DevPanelMessageData> {
  try {
    const raw = localStorage.getItem(storageKey(chatId));
    if (!raw) return new Map();
    const entries: [string, DevPanelMessageData][] = JSON.parse(raw);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DevPanelProvider({
  chatId,
  messages,
  children,
}: {
  chatId: string;
  messages: ChatMessage[];
  children: ReactNode;
}) {
  const { dataStream } = useDataStream();

  // Restored data from localStorage (loaded once on mount)
  const restoredRef = useRef<Map<string, DevPanelMessageData> | null>(null);
  if (restoredRef.current === null) {
    restoredRef.current = IS_DEV_MODE
      ? loadFromStorage(chatId)
      : new Map();
  }

  // Previous map — prevents losing entries during transient re-computation.
  // When msg2 assistant appears but its debug events haven't arrived yet,
  // the batch→message matching briefly shifts. prevMapRef preserves msg1's
  // entry until the correct mapping is re-established.
  const prevMapRef = useRef<Map<string, DevPanelMessageData>>(new Map());

  const debugDataMap = useMemo(() => {
    // Skip all processing in production — no debug events will ever arrive
    if (!IS_DEV_MODE) return new Map<string, DevPanelMessageData>();

    // Start with restored data from localStorage
    const map = new Map<string, DevPanelMessageData>(restoredRef.current!);

    // Merge entries from previous computation (prevents transient loss)
    for (const [key, value] of prevMapRef.current) {
      if (!map.has(key)) map.set(key, value);
    }

    const debugEvents = dataStream.filter((e) =>
      e.type.startsWith("data-debug-"),
    );

    if (debugEvents.length > 0) {
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
      const offset = assistantMessages.length - batches.length;
      for (
        let i = 0;
        i < Math.min(batches.length, assistantMessages.length);
        i++
      ) {
        map.set(assistantMessages[offset + i].id, batches[i]);
      }
    }

    // Save for next computation cycle
    prevMapRef.current = map;
    return map;
  }, [dataStream, messages]);

  // Persist to localStorage when new finished entries appear
  const prevFinishedCountRef = useRef(0);
  useEffect(() => {
    if (!IS_DEV_MODE) return;
    const finishedCount = Array.from(debugDataMap.values()).filter(
      (v) => !!v.finish,
    ).length;
    if (finishedCount > prevFinishedCountRef.current) {
      prevFinishedCountRef.current = finishedCount;
      saveToStorage(chatId, debugDataMap);
    }
  }, [debugDataMap, chatId]);

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
