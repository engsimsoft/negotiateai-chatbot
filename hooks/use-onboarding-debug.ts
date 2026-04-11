"use client";

/**
 * useOnboardingDebug — Collects debug events from service-chat streaming
 * for the briefing onboarding flow.
 *
 * Unlike DevPanelProvider (which relies on DataStreamContext from the main chat),
 * this hook works with useChat's onData callback directly.
 *
 * Persistence: saves to localStorage on each finish event, restores on init.
 * Guard: no-op when NEXT_PUBLIC_SIMPLY_DEV_MODE is not "true".
 *
 * ТЗ-DEV3: Onboarding DevPanel
 */

import { useState, useCallback, useRef } from "react";
import {
  DEBUG_EVENT_SCHEMA_VERSION,
  type DebugStepData,
  type DebugFinishData,
  type DebugGuardianData,
  type DebugPromptData,
} from "@/lib/ai/debug-events";
import type { DevPanelMessageData } from "@/components/dev-panel/dev-panel-provider";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IS_DEV_MODE = process.env.NEXT_PUBLIC_SIMPLY_DEV_MODE === "true";
const STORAGE_KEY = "simply-dev-onboarding-debug";

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

interface StoredPayload {
  schemaVersion: number;
  entries: [string, DevPanelMessageData][];
}

function saveToStorage(map: Map<string, DevPanelMessageData>): void {
  try {
    const payload: StoredPayload = {
      schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
      entries: Array.from(map.entries()),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Silently fail (quota, SSR, etc.)
  }
}

function loadFromStorage(): Map<string, DevPanelMessageData> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
        "[OnboardingDebug] Clearing legacy debug cache (schema mismatch)",
      );
      localStorage.removeItem(STORAGE_KEY);
      return new Map();
    }
    return new Map(parsed.entries as [string, DevPanelMessageData][]);
  } catch {
    return new Map();
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface OnboardingDebugPart {
  type: string;
  data?: unknown;
}

export function useOnboardingDebug() {
  // Initialize from localStorage (dev mode only)
  const [debugMap, setDebugMap] = useState<Map<string, DevPanelMessageData>>(
    () => (IS_DEV_MODE ? loadFromStorage() : new Map()),
  );

  // Current accumulator for the in-flight response
  const currentRef = useRef<DevPanelMessageData | null>(null);
  // Track which assistant message ID this batch maps to
  const currentMessageIdRef = useRef<string | null>(null);

  /**
   * Feed a data part from useChat's onData callback.
   * Call this for every part — non-debug events are ignored.
   */
  const handleDataPart = useCallback(
    (part: OnboardingDebugPart) => {
      if (!IS_DEV_MODE) return;
      if (!part.type.startsWith("data-debug-")) return;

      const d = part.data as Record<string, unknown>;

      switch (part.type) {
        case "data-debug-prompt": {
          // Start a new batch
          currentRef.current = {
            prompt: d as unknown as DebugPromptData,
            steps: [],
            guardians: [],
            errors: [],
            warnings: [],
          };
          break;
        }
        case "data-debug-step": {
          if (currentRef.current) {
            currentRef.current.steps.push(d as unknown as DebugStepData);
            // Update map for live streaming display
            if (currentMessageIdRef.current) {
              setDebugMap((prev) => {
                const next = new Map(prev);
                next.set(currentMessageIdRef.current!, { ...currentRef.current! });
                return next;
              });
            }
          }
          break;
        }
        case "data-debug-guardian": {
          if (currentRef.current) {
            currentRef.current.guardians.push(
              d as unknown as DebugGuardianData,
            );
          }
          break;
        }
        case "data-debug-finish": {
          if (currentRef.current) {
            currentRef.current.finish = d as unknown as DebugFinishData;
            if (currentMessageIdRef.current) {
              const msgId = currentMessageIdRef.current;
              const batch = { ...currentRef.current };
              setDebugMap((prev) => {
                const next = new Map(prev);
                next.set(msgId, batch);
                // Persist to localStorage
                saveToStorage(next);
                return next;
              });
            }
            currentRef.current = null;
            currentMessageIdRef.current = null;
          }
          break;
        }
      }
    },
    [],
  );

  /**
   * Bind the current debug batch to an assistant message ID.
   * Call this when a new assistant message appears during streaming.
   */
  const bindToMessage = useCallback((messageId: string) => {
    if (!IS_DEV_MODE) return;
    currentMessageIdRef.current = messageId;
    // If we already have accumulated data, map it immediately
    if (currentRef.current) {
      setDebugMap((prev) => {
        const next = new Map(prev);
        next.set(messageId, { ...currentRef.current! });
        return next;
      });
    }
  }, []);

  return { debugMap, handleDataPart, bindToMessage };
}
