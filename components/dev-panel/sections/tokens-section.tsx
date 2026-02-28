import type { DevPanelMessageData } from "../dev-panel-provider";

export function TokensSection({ data }: { data: DevPanelMessageData }) {
  const f = data.finish;
  const inputTokens =
    f?.totalInputTokens ??
    data.steps.reduce((s, st) => s + st.inputTokens, 0);
  const outputTokens =
    f?.totalOutputTokens ??
    data.steps.reduce((s, st) => s + st.outputTokens, 0);
  const cachedTokens =
    f?.totalCachedTokens ??
    data.steps.reduce((s, st) => s + st.cachedTokens, 0);
  const reasoningTokens =
    f?.totalReasoningTokens ??
    data.steps.reduce((s, st) => s + st.reasoningTokens, 0);
  const totalTokens = inputTokens + outputTokens;
  const cost = f?.estimatedCostRub;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tokens &amp; Cost
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Input</span>
        <span>{inputTokens.toLocaleString("ru-RU")}</span>

        <span className="text-muted-foreground">Output</span>
        <span>{outputTokens.toLocaleString("ru-RU")}</span>

        {cachedTokens > 0 && (
          <>
            <span className="text-muted-foreground">Cached</span>
            <span>{cachedTokens.toLocaleString("ru-RU")}</span>
          </>
        )}

        {reasoningTokens > 0 && (
          <>
            <span className="text-muted-foreground">Reasoning</span>
            <span>{reasoningTokens.toLocaleString("ru-RU")}</span>
          </>
        )}

        <span className="text-muted-foreground">Total</span>
        <span className="font-medium">
          {totalTokens.toLocaleString("ru-RU")}
        </span>

        {cost != null && (
          <>
            <span className="text-muted-foreground">Cost</span>
            <span className="font-medium">&#8381;{cost.toFixed(2)}</span>
          </>
        )}
      </div>
    </section>
  );
}
