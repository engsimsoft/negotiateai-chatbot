"use client";

/**
 * OnboardingDebugProvider — Wraps children in DevPanelContext
 * using debug data collected by useOnboardingDebug hook.
 *
 * This replaces DevPanelProvider for contexts where DataStreamContext
 * is not available (e.g. briefing onboarding with useChat).
 *
 * ТЗ-DEV3: Onboarding DevPanel
 */

import { useMemo, type ReactNode } from "react";
import {
  DevPanelContext,
  type DevPanelContextValue,
  type DevPanelMessageData,
} from "./dev-panel-provider";

export function OnboardingDebugProvider({
  debugMap,
  children,
}: {
  debugMap: Map<string, DevPanelMessageData>;
  children: ReactNode;
}) {
  // ТЗ-DevPanelErrors: DevPanelContextValue now exposes both message-bound
  // and global error buckets. Onboarding flow has no global errors pipeline,
  // so we supply an empty array. Memoised to keep the value stable.
  const value = useMemo<DevPanelContextValue>(
    () => ({ byMessage: debugMap, globalErrors: [] }),
    [debugMap],
  );

  return (
    <DevPanelContext.Provider value={value}>
      {children}
    </DevPanelContext.Provider>
  );
}
