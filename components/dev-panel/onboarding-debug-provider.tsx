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

import type { ReactNode } from "react";
import { DevPanelContext, type DevPanelMessageData } from "./dev-panel-provider";

export function OnboardingDebugProvider({
  debugMap,
  children,
}: {
  debugMap: Map<string, DevPanelMessageData>;
  children: ReactNode;
}) {
  return (
    <DevPanelContext.Provider value={debugMap}>
      {children}
    </DevPanelContext.Provider>
  );
}
