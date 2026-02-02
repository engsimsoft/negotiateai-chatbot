import { useState, useEffect } from "react";

/**
 * Hook to track media query matches
 *
 * Returns `null` during SSR/hydration, then actual value after mount.
 * Use this to prevent hydration mismatches.
 *
 * @example
 * const isDesktop = useMediaQuery("(min-width: 768px)");
 * if (isDesktop === null) return null; // or skeleton
 */
export function useMediaQuery(query: string): boolean | null {
  const [matches, setMatches] = useState<boolean | null>(null);

  useEffect(() => {
    const media = window.matchMedia(query);

    // Set initial value
    setMatches(media.matches);

    // Create listener
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add listener
    media.addEventListener("change", listener);

    // Cleanup
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
