import type { DevPanelMessageData } from "../dev-panel-provider";

const MODEL_DISPLAY: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku": "Haiku",
  "claude-sonnet": "Sonnet",
  "claude-opus": "Opus",
  "grok-4-1-fast-non-reasoning": "Grok 4.1 Fast",
  "grok-4-1-fast-reasoning": "Grok 4.1 Fast (reasoning)",
  "grok-4.20-0309-reasoning": "Grok 4.20 (reasoning)",
  "grok-4.20-0309-non-reasoning": "Grok 4.20",
  "grok-4.20-multi-agent-0309": "Grok 4.20 Multi-Agent",
  "kimi-k2.6": "Kimi K2.6",
};

const REASON_COLORS: Record<string, string> = {
  stop: "",
  "end-turn": "",
  "tool-calls": "",
  length: "text-yellow-600 dark:text-yellow-400",
  "content-filter": "text-red-600 dark:text-red-400",
  error: "text-red-600 dark:text-red-400",
  unknown: "text-red-600 dark:text-red-400",
};

export function ModelSection({ data }: { data: DevPanelMessageData }) {
  const modelId = data.finish?.modelId ?? data.steps[0]?.modelId ?? "—";
  const modelName = MODEL_DISPLAY[modelId] ?? modelId;
  const finishReason =
    data.finish?.finishReason ?? data.steps.at(-1)?.finishReason ?? "—";
  const totalSteps = data.finish?.totalSteps ?? data.steps.length;
  const duration = data.finish?.totalDurationMs;
  const ttft = data.finish?.timeToFirstTokenMs;
  const reasonColor = REASON_COLORS[finishReason] ?? "";

  return (
    <section>
      <h3 className="mb-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Model
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Model</span>
        <span className="font-medium">{modelName}</span>

        <span className="text-muted-foreground">Model ID</span>
        <span className="font-mono text-xs">{modelId}</span>

        <span className="text-muted-foreground">Finish reason</span>
        <span className={`font-mono text-xs ${reasonColor}`}>{finishReason}</span>

        <span className="text-muted-foreground">Steps</span>
        <span>{totalSteps}</span>

        {duration != null && (
          <>
            <span className="text-muted-foreground">Duration</span>
            <span>
              {duration < 1000
                ? `${duration}ms`
                : `${(duration / 1000).toFixed(1)}s`}
            </span>
          </>
        )}

        {ttft != null && (
          <>
            <span className="text-muted-foreground">TTFT</span>
            <span>{ttft}ms</span>
          </>
        )}

        {data.compaction && (
          <>
            <span className="text-muted-foreground">Compaction</span>
            <span className={data.compaction.triggered ? "font-medium text-amber-600 dark:text-amber-400" : ""}>
              {data.compaction.triggered ? "Triggered" : "Not triggered"}
            </span>
            {data.compaction.triggered && data.compaction.iterations.map((it, i) => (
              <div key={i} className="col-span-2 ml-2 font-mono text-xs text-muted-foreground">
                {it.type}: {it.inputTokens.toLocaleString("ru-RU")} in / {it.outputTokens.toLocaleString("ru-RU")} out
              </div>
            ))}
          </>
        )}

        {/* ТЗ-2: Dev override info */}
        {data.prompt?.taskId && (
          <>
            <span className="text-muted-foreground">Task ID</span>
            <span className="font-mono text-xs">{data.prompt.taskId}</span>
          </>
        )}

        {data.prompt?.overrideActive && (
          <>
            <span className="text-muted-foreground">Override</span>
            <span className="font-mono text-xs text-amber-600 dark:text-amber-400">
              {data.prompt.defaultModelId ?? "?"} → {data.prompt.effectiveModelId ?? "?"}
            </span>
          </>
        )}
      </div>
    </section>
  );
}
