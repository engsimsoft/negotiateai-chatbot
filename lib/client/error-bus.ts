/**
 * ТЗ-DevPanelErrors: Client-side error bus.
 *
 * Simple pub/sub emitter for reporting client-captured errors to DevPanel.
 * Publishers: window.onerror, window.unhandledrejection, useChat.onError,
 * React Error Boundaries.
 * Subscribers: DevPanelProvider (collects into global errors bucket).
 *
 * Why an event bus and not React context: Error Boundary is a class
 * component and cannot directly use React hooks. Using a plain emitter
 * keeps Error Boundary independent of the React tree it protects.
 *
 * All activity is gated on NEXT_PUBLIC_SIMPLY_DEV_MODE at the subscriber
 * level — publishing is always allowed (cheap, no subscribers = no-op).
 */

import type { DebugErrorData } from "@/lib/ai/debug-events";

type Listener = (error: DebugErrorData) => void;

const listeners = new Set<Listener>();

/**
 * Report a client-captured error. Called from window listeners, Error
 * Boundaries, and useChat onError callback. Safe to call multiple times
 * for the same error — deduplication is the responsibility of subscribers.
 *
 * Accepts data without timestamp (stamped here automatically).
 */
export function reportClientError(
  data: Omit<DebugErrorData, "timestamp"> & { timestamp?: number },
): void {
  const error: DebugErrorData = {
    ...data,
    timestamp: data.timestamp ?? Date.now(),
  };
  for (const listener of listeners) {
    try {
      listener(error);
    } catch {
      // A listener crashing must never break the bus or the caller.
    }
  }
}

/**
 * Subscribe to client-captured errors. Returns an unsubscribe function.
 * Typical usage in a React effect:
 *
 * ```ts
 * useEffect(() => subscribeToClientErrors((err) => setState(...)), []);
 * ```
 */
export function subscribeToClientErrors(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
