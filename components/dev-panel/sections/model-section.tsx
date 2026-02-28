import type { DevPanelMessageData } from "../dev-panel-provider";

const MODEL_DISPLAY: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "claude-opus-4-6": "Opus 4.6",
  "claude-haiku": "Haiku",
  "claude-sonnet": "Sonnet",
  "claude-opus": "Opus",
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
      </div>
    </section>
  );
}
