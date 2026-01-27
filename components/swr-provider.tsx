"use client";

import type { ReactNode } from "react";
import { SWRConfig } from "swr";

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        // Disable automatic revalidation on focus to prevent unnecessary requests
        revalidateOnFocus: false,
        // Disable automatic revalidation on reconnect
        revalidateOnReconnect: false,
        // Increase deduping interval to 5 seconds to prevent duplicate requests
        dedupingInterval: 5000,
        // Disable automatic refresh
        refreshInterval: 0,
        // Use error retry with exponential backoff
        errorRetryCount: 3,
        errorRetryInterval: 1000,
        // Keep previous data while revalidating
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}
