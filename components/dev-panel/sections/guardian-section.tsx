import type { DevPanelMessageData } from "../dev-panel-provider";

const ACTION_COLORS: Record<string, string> = {
  clean: "text-green-600 dark:text-green-400",
  blocked: "text-red-600 dark:text-red-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  bypassed: "text-blue-600 dark:text-blue-400",
};

const ACTION_LABELS: Record<string, string> = {
  clean: "\u2713 Clean",
  blocked: "\u2715 Blocked",
  warning: "\u26A0 Warning",
  bypassed: "\u21B7 Bypassed",
};

export function GuardianSection({ data }: { data: DevPanelMessageData }) {
  if (data.guardians.length === 0) return null;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Guardian
      </h3>
      <div className="flex flex-col gap-2">
        {data.guardians.map((g, i) => (
          <div
            key={i}
            className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono">Step {g.stepIndex}</span>
                <span
                  className={
                    ACTION_COLORS[g.action] ?? "text-muted-foreground"
                  }
                >
                  {ACTION_LABELS[g.action] ?? g.action}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {g.confidence > 0 && <span>conf: {g.confidence}</span>}
                <span>{g.durationMs}ms</span>
              </div>
            </div>

            {g.details.length > 0 && (
              <div className="mt-1.5 space-y-1">
                {g.details.map((d, j) => (
                  <div
                    key={j}
                    className="rounded bg-muted/40 px-2 py-1 text-[10px]"
                  >
                    <span className="font-medium">{d.toolMentioned}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      &mdash; {d.pattern}
                    </span>
                    {d.snippet && (
                      <div className="mt-0.5 truncate text-muted-foreground/60">
                        {d.snippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
