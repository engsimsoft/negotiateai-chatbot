import { Headphones } from "lucide-react";

/**
 * ТЗ-А4: Sticky player placeholder — teaser for future audio podcast.
 * Positioned below header (top-14 = header height).
 */
export function BriefingPlayerPlaceholder() {
  return (
    <div className="sticky top-14 z-[5] border-b bg-muted/50 px-4 py-3 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Headphones className="size-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Скоро: аудиоподкаст
          </p>
          <p className="text-xs text-muted-foreground">
            Плеер появится в следующем обновлении
          </p>
        </div>
      </div>
    </div>
  );
}
