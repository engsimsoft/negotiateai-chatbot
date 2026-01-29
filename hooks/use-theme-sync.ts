"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";

interface UserProfile {
  theme: string | null;
}

/**
 * ТЗ-3A: Syncs theme from DB to next-themes on initial load.
 * When user has a saved theme preference in their profile,
 * it overrides the default next-themes setting.
 */
export function useThemeSync() {
  const { setTheme } = useTheme();
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);

  useEffect(() => {
    if (profile?.theme) {
      setTheme(profile.theme);
    }
  }, [profile?.theme, setTheme]);
}
