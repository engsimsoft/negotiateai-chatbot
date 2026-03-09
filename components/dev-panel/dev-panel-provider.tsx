"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
    const entries = Array.from(map.entries()).filter(([, v]) => !!v.finish);
    if (entries.length === 0) return;
    localStorage.setItem(storageKey(chatId), JSON.stringify(entries));
  } catch {
    // Silently fail (quota, SSR, etc.)
  }
}

function loadFromStorage(chatId: string): Map<string, DevPanelMessageData> {
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
// Filter: exclude empty shell assistant messages (no text/tool/reasoning parts).
// Mirrors the same early-return condition in PreviewMessage — shells are never
// rendered in the DOM, so DevPanelFooter never mounts for their IDs.
// ---------------------------------------------------------------------------

function isVisibleAssistantMessage(m: ChatMessage): boolean {
  if (m.role !== "assistant") return false;
  const parts = m.parts as Array<{ type: string; text?: string }> | undefined;
  if (!parts) return false;
  return parts.some(
    (p) =>
      (p.type === "text" && p.text?.trim()) ||
      (p.type === "reasoning" && p.text?.trim()) ||
      p.type.startsWith("tool-"),
  );
}

// ---------------------------------------------------------------------------
// Parse dataStream events into sequential batches
// (prompt → steps/guardians → finish per AI call)
// ---------------------------------------------------------------------------

type DataStreamEvent = { type: string; data?: unknown };

function parseBatches(dataStream: DataStreamEvent[]): DevPanelMessageData[] {
  const debugEvents = dataStream.filter((e) =>
    e.type.startsWith("data-debug-"),
  );
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

  return batches;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DevPanelProvider({
  chatId,
  messages,
  status,
  children,
}: {
  chatId: string;
  messages: ChatMessage[];
  /** status from useChat: 'ready' | 'submitted' | 'streaming' | 'error' */
  status: string;
  children: ReactNode;
}) {
  const { dataStream } = useDataStream();

  // Permanently locked assignments: messageId → batch data.
  // Initialized from localStorage for persistence across page reloads.
  const [lockedMap, setLockedMap] = useState<Map<string, DevPanelMessageData>>(
    () => (IS_DEV_MODE ? loadFromStorage(chatId) : new Map()),
  );

  // Number of assistant messages present at mount.
  // New streamed batches correspond to messages starting from this index.
  const initialAssistantCountRef = useRef<number | null>(null);
  if (initialAssistantCountRef.current === null) {
    initialAssistantCountRef.current = messages.filter(
      isVisibleAssistantMessage,
    ).length;
  }

  // How many batches have already been locked into lockedMap.
  const lockedBatchCountRef = useRef(0);

  // Parse debug events into batches (only recomputed when dataStream changes).
  const batches = useMemo(
    () => (IS_DEV_MODE ? parseBatches(dataStream) : []),
    [dataStream],
  );

  // Lock assignments when status === 'ready'.
  //
  // Why useEffect + status === 'ready'?
  //   When status transitions to 'ready', the AI SDK has finished streaming AND
  //   React has committed the final `messages` state. Waiting for this moment
  //   guarantees the new assistant message is present in `messages` when we
  //   attempt position-based batch→message assignment.
  //
  // Dependencies include `messages` so that if status is already ready but
  // `messages` updates (e.g. throttle flush arrives after status transition),
  // we retry the assignment automatically.
  //
  // Note: AI SDK v5 uses 'ready' (not 'idle') for the non-streaming state.
  useEffect(() => {
    if (!IS_DEV_MODE) return;
    if (status !== "ready") return;

    const assistantMessages = messages.filter(isVisibleAssistantMessage);
    const baseOffset = initialAssistantCountRef.current!;
    const newEntries: Array<[string, DevPanelMessageData]> = [];

    for (let i = lockedBatchCountRef.current; i < batches.length; i++) {
      if (!batches[i].finish) break;
      const msgIdx = baseOffset + i;
      if (msgIdx < 0 || msgIdx >= assistantMessages.length) break;
      newEntries.push([assistantMessages[msgIdx].id, batches[i]]);
    }

    if (newEntries.length > 0) {
      lockedBatchCountRef.current += newEntries.length;
      setLockedMap((prev) => {
        const next = new Map(prev);
        for (const [id, data] of newEntries) next.set(id, data);
        return next;
      });
    }
  }, [status, messages, batches]);

  // Persist to localStorage when locked map gains new finished entries.
  useEffect(() => {
    if (!IS_DEV_MODE) return;
    saveToStorage(chatId, lockedMap);
  }, [lockedMap, chatId]);

  // Build the final context value.
  // During streaming: add a tentative entry for the unfinished (streaming) batch
  // mapped to the last assistant message (the one currently being generated).
  // When idle: return lockedMap directly (stable reference, no extra work).
  const debugDataMap = useMemo(() => {
    if (!IS_DEV_MODE) return new Map<string, DevPanelMessageData>();
    if (status === "ready") return lockedMap;

    // Find the unfinished streaming batch (at most one)
    const streamingBatch = batches.find((b) => !b.finish);
    if (!streamingBatch) return lockedMap;

    const assistantMessages = messages.filter(isVisibleAssistantMessage);
    if (assistantMessages.length === 0) return lockedMap;

    const lastMsg = assistantMessages[assistantMessages.length - 1];
    if (lockedMap.has(lastMsg.id)) return lockedMap; // Already locked, don't overwrite

    const next = new Map(lockedMap);
    next.set(lastMsg.id, streamingBatch);
    return next;
  }, [status, lockedMap, batches, messages]);

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
