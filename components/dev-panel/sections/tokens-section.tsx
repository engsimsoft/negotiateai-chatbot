import { getStepCostRub } from "@/lib/ai/providers";
import type { DevPanelMessageData } from "../dev-panel-provider";

export function TokensSection({ data }: { data: DevPanelMessageData }) {
  // Use per-step sums — these represent the actual billed amounts.
  // finish.totalXxxTokens is the last step's cumulative, not the real sum.
  // All input fields are DISJOINT (schema v2): no overlap between them.
  const noCacheInputTokens = data.steps.reduce(
    (s, st) => s + st.noCacheInputTokens,
    0,
  );
  const cacheReadTokens = data.steps.reduce(
    (s, st) => s + st.cacheReadTokens,
    0,
  );
  const cacheWriteTokens = data.steps.reduce(
    (s, st) => s + st.cacheWriteTokens,
    0,
  );
  const outputTokens = data.steps.reduce((s, st) => s + st.outputTokens, 0);
  const reasoningTokens = data.steps.reduce(
    (s, st) => s + st.reasoningTokens,
    0,
  );
  const totalTokens =
    noCacheInputTokens +
    cacheReadTokens +
    cacheWriteTokens +
    outputTokens +
    reasoningTokens;

  // ТЗ-DEV3: Real cost = sum of per-step costs (each step is a separate API call).
  // Uses server-calculated stepCostRub (TokenLens SSOT) with local fallback.
  const isCostFallback = data.steps.length === 0 && data.finish?.estimatedCostRub != null;
  const cost =
    data.steps.length > 0
      ? data.steps.reduce((sum, step) => sum + getStepCostRub(step), 0)
      : data.finish?.estimatedCostRub;

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Tokens &amp; Cost
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Input (fresh)</span>
        <span>{noCacheInputTokens.toLocaleString("ru-RU")}</span>

        {cacheReadTokens > 0 && (
          <>
            <span className="text-muted-foreground">Cache read</span>
            <span>{cacheReadTokens.toLocaleString("ru-RU")}</span>
          </>
        )}

        {cacheWriteTokens > 0 && (
          <>
            <span className="text-muted-foreground">Cache write</span>
            <span>{cacheWriteTokens.toLocaleString("ru-RU")}</span>
          </>
        )}

        <span className="text-muted-foreground">Output</span>
        <span>{outputTokens.toLocaleString("ru-RU")}</span>

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
            <span className="font-medium">{isCostFallback ? "~" : ""}&#8381;{cost.toFixed(2)}</span>
          </>
        )}
      </div>
    </section>
  );
}
