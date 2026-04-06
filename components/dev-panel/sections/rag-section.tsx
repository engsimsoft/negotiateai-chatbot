import type { DevPanelMessageData } from "../dev-panel-provider";

const CATEGORY_COLORS: Record<string, string> = {
  fact: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  task: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  preference: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  calendar: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  person: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  decision: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export function RagSection({ data }: { data: DevPanelMessageData }) {
  const rag = data.rag;
  if (!rag) return null;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        MIND Memory
      </h3>

      {rag.facts.length === 0 ? (
        <div className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Нет релевантных воспоминаний
          <span className="ml-2 opacity-60">({rag.searchDurationMs}ms)</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rag.facts.map((fact, i) => (
            <div
              key={i}
              className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[fact.category] ?? "bg-muted text-muted-foreground"}`}
                >
                  {fact.category}
                </span>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>sim: {fact.similarity.toFixed(3)}</span>
                  <span>conf: {Math.round(fact.confidence * 100)}%</span>
                </div>
              </div>
              <div className="mt-1 text-foreground/80">{fact.content}</div>
            </div>
          ))}

          {/* Footer stats */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {rag.factsInjected} / {rag.facts.length} injected
            </span>
            <span>
              {rag.voyageTokens} tok | {rag.searchDurationMs}ms
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
