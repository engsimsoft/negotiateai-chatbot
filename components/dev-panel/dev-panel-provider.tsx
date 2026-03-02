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

  // Stable batch→messageId assignments. Populated incrementally: once a batch
  // is assigned to a message, the mapping never changes. This prevents the
  // offset-shift bug where a new assistant message appears in `messages` before
  // its debug events arrive, causing all previous mappings to shift by 1.
  const batchAssignmentsRef = useRef<string[]>([]);

  const debugDataMap = useMemo(() => {
    // Skip all processing in production — no debug events will ever arrive
    if (!IS_DEV_MODE) return new Map<string, DevPanelMessageData>();

    // Start with restored data from localStorage
    const map = new Map<string, DevPanelMessageData>(restoredRef.current!);

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

      // Stable incremental assignment: each batch is assigned to a message
      // ONCE and the mapping never changes. This prevents the offset-shift bug
      // where a new assistant message appears before its debug events arrive.
      //
      // We use `offset` only for NEW batch assignments (when batches.length grows).
      // Previously locked assignments are never recalculated — they survive
      // transient states where offset would be wrong.
      const assistantMessages = messages.filter((m) => m.role === "assistant");
      const assignments = batchAssignmentsRef.current;
      const offset = Math.max(0, assistantMessages.length - batches.length);

      // Assign only NEW batches (index >= assignments.length)
      for (let i = assignments.length; i < batches.length; i++) {
        const msgIdx = offset + i;
        if (msgIdx >= 0 && msgIdx < assistantMessages.length) {
          assignments.push(assistantMessages[msgIdx].id);
        }
      }

      // Build map from stable assignments
      for (let i = 0; i < Math.min(assignments.length, batches.length); i++) {
        map.set(assignments[i], batches[i]);
      }
    }

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
