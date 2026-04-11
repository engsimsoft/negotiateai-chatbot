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
import {
  DEBUG_EVENT_SCHEMA_VERSION,
  type DebugStepData,
  type DebugFinishData,
  type DebugGuardianData,
  type DebugPromptData,
  type DebugRagData,
  type DebugCompactionData,
  type DebugErrorData,
  type DebugWarningData,
} from "@/lib/ai/debug-events";
import {
  reportClientError,
  subscribeToClientErrors,
} from "@/lib/client/error-bus";
import type { ChatMessage } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DevPanelMessageData {
  prompt?: DebugPromptData;
  rag?: DebugRagData;
  compaction?: DebugCompactionData;
  steps: DebugStepData[];
  guardians: DebugGuardianData[];
  /** ТЗ-DevPanelErrors: errors and warnings captured for this assistant message. */
  errors: DebugErrorData[];
  warnings: DebugWarningData[];
  finish?: DebugFinishData;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * ТЗ-DevPanelErrors: context value has two buckets:
 *  - `byMessage`: debug data attached to specific assistant messages (existing)
 *  - `globalErrors`: client-captured errors not tied to a message
 *    (render crashes, pre-stream window errors, useChat errors)
 */
export interface DevPanelContextValue {
  byMessage: Map<string, DevPanelMessageData>;
  globalErrors: DebugErrorData[];
}

export const DevPanelContext = createContext<DevPanelContextValue>({
  byMessage: new Map(),
  globalErrors: [],
});

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

interface StoredPayload {
  schemaVersion: number;
  entries: [string, DevPanelMessageData][];
}

function saveToStorage(
  chatId: string,
  map: Map<string, DevPanelMessageData>,
): void {
  try {
    const entries = Array.from(map.entries()).filter(([, v]) => !!v.finish);
    if (entries.length === 0) return;
    const payload: StoredPayload = {
      schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
      entries,
    };
    localStorage.setItem(storageKey(chatId), JSON.stringify(payload));
  } catch {
    // Silently fail (quota, SSR, etc.)
  }
}

function loadFromStorage(chatId: string): Map<string, DevPanelMessageData> {
  try {
    const raw = localStorage.getItem(storageKey(chatId));
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    // Schema migration: wipe legacy (unversioned/older) data
    if (
      !parsed ||
      typeof parsed !== "object" ||
      parsed.schemaVersion !== DEBUG_EVENT_SCHEMA_VERSION ||
      !Array.isArray(parsed.entries)
    ) {
      console.warn(
        `[DevPanel] Clearing legacy debug cache for chat ${chatId} (schema mismatch)`,
      );
      localStorage.removeItem(storageKey(chatId));
      return new Map();
    }
    return new Map(parsed.entries as [string, DevPanelMessageData][]);
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
          errors: [],
          warnings: [],
        };
        break;
      case "data-debug-rag":
        if (current) current.rag = d as unknown as DebugRagData;
        break;
      case "data-debug-step":
        if (current) current.steps.push(d as unknown as DebugStepData);
        break;
      case "data-debug-guardian":
        if (current)
          current.guardians.push(d as unknown as DebugGuardianData);
        break;
      case "data-debug-compaction":
        if (current) current.compaction = d as unknown as DebugCompactionData;
        break;
      // ТЗ-DevPanelErrors: collect server-emitted errors and warnings into current batch
      case "data-debug-error":
        if (current) current.errors.push(d as unknown as DebugErrorData);
        break;
      case "data-debug-warning":
        if (current) current.warnings.push(d as unknown as DebugWarningData);
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

  // ТЗ-DevPanelErrors: global (not message-bound) client errors.
  // Captured from window.onerror, unhandledrejection, useChat.onError,
  // and React Error Boundaries via the shared error bus.
  const [globalErrors, setGlobalErrors] = useState<DebugErrorData[]>([]);
  const MAX_GLOBAL_ERRORS = 50;

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

  // ТЗ-DevPanelErrors: subscribe to the client error bus.
  // Error Boundaries and useChat.onError publish here. We also install
  // window.onerror and unhandledrejection listeners to catch top-level
  // crashes. All captures funnel into globalErrors state, capped at
  // MAX_GLOBAL_ERRORS (circular buffer).
  useEffect(() => {
    if (!IS_DEV_MODE) return;

    const pushGlobal = (error: DebugErrorData) => {
      setGlobalErrors((prev) => {
        const next = [...prev, error];
        return next.length > MAX_GLOBAL_ERRORS
          ? next.slice(next.length - MAX_GLOBAL_ERRORS)
          : next;
      });
    };

    const unsubscribe = subscribeToClientErrors(pushGlobal);

    const handleWindowError = (event: ErrorEvent) => {
      reportClientError({
        source: "client:window",
        message: event.message || "Uncaught error",
        stack: event.error instanceof Error
          ? event.error.stack?.slice(0, 2000)
          : undefined,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({
        source: "client:unhandled-rejection",
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unhandled promise rejection",
        stack: reason instanceof Error ? reason.stack?.slice(0, 2000) : undefined,
      });
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      unsubscribe();
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

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

  // Combine message-bound map and global errors into the context value.
  const contextValue = useMemo<DevPanelContextValue>(
    () => ({ byMessage: debugDataMap, globalErrors }),
    [debugDataMap, globalErrors],
  );

  return (
    <DevPanelContext.Provider value={contextValue}>
      {children}
    </DevPanelContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDevPanel(
  messageId: string,
): DevPanelMessageData | undefined {
  const { byMessage } = useContext(DevPanelContext);
  return byMessage.get(messageId);
}

/**
 * ТЗ-DevPanelErrors: access client errors not tied to any specific message
 * (render crashes, pre-stream window errors, useChat.onError before any
 * assistant message exists). Used by a global indicator in chat header.
 */
export function useDevPanelGlobalErrors(): DebugErrorData[] {
  const { globalErrors } = useContext(DevPanelContext);
  return globalErrors;
}
