// ТЗ-Б2: Hook for podcast generation with streaming progress

"use client";

import { useState, useCallback, useRef } from "react";
import type { PodcastProgressEvent, AudioUrls, AudioDurations } from "@/lib/podcast/types";

/** Per-topic generation status */
export interface PodcastTopicStatus {
  topicId: string;
  step: "pending" | "script" | "recording" | "done" | "error";
  message: string;
  url?: string;
  durationSeconds?: number;
}

interface UsePodcastGenerationReturn {
  /** Per-topic statuses */
  topicStatuses: PodcastTopicStatus[];
  isGenerating: boolean;
  error: string | null;
  /** Summary message on completion */
  completionMessage: string | null;
  /** Ready/failed counts on completion */
  readyCount: number;
  failedCount: number;
  /** Start generation for given topicIds (empty = all) */
  startGeneration: (topicIds?: string[]) => void;
  reset: () => void;
}

export function usePodcastGeneration(
  /** All topic IDs for initializing pending statuses */
  allTopicIds: string[],
  /** Callback when generation completes — updates parent audio state */
  onComplete?: (audioUrls: AudioUrls, audioDurations: AudioDurations, readyCount: number, failedCount: number) => void,
): UsePodcastGenerationReturn {
  const [topicStatuses, setTopicStatuses] = useState<PodcastTopicStatus[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const [readyCount, setReadyCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Collect results during generation for onComplete callback
  const resultsRef = useRef<{ urls: AudioUrls; durations: AudioDurations }>({
    urls: {},
    durations: {},
  });

  const startGeneration = useCallback(
    (topicIds?: string[]) => {
      if (isGenerating) return;

      // Initialize statuses for selected topics
      const selectedIds = topicIds?.length ? topicIds : allTopicIds;
      setTopicStatuses(
        selectedIds.map((id) => ({
          topicId: id,
          step: "pending" as const,
          message: "Ожидание...",
        })),
      );
      setError(null);
      setCompletionMessage(null);
      setReadyCount(0);
      setFailedCount(0);
      setIsGenerating(true);
      resultsRef.current = { urls: {}, durations: {} };

      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      (async () => {
        try {
          const response = await fetch("/api/briefing/podcast/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topicIds: topicIds?.length ? topicIds : undefined }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            throw new Error("Не удалось запустить генерацию подкаста");
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const event: PodcastProgressEvent = JSON.parse(line);

                if (event.step === "error" && !event.topicId) {
                  // Global error — stop
                  setError(event.message);
                  setIsGenerating(false);
                  return;
                }

                if (event.step === "complete") {
                  setCompletionMessage(event.message);
                  setReadyCount(event.readyCount ?? 0);
                  setFailedCount(event.failedCount ?? 0);
                  setIsGenerating(false);

                  // Notify parent
                  onComplete?.(
                    resultsRef.current.urls,
                    resultsRef.current.durations,
                    event.readyCount ?? 0,
                    event.failedCount ?? 0,
                  );
                  return;
                }

                // Per-topic events: script, recording, done, error
                if (event.topicId) {
                  // Collect results for done events
                  if (event.step === "done" && event.url && event.durationSeconds) {
                    resultsRef.current.urls[event.topicId] = event.url;
                    resultsRef.current.durations[event.topicId] = event.durationSeconds;
                  }

                  setTopicStatuses((prev) =>
                    prev.map((t) =>
                      t.topicId === event.topicId
                        ? {
                            ...t,
                            step: event.step as PodcastTopicStatus["step"],
                            message: event.message,
                            url: event.url ?? t.url,
                            durationSeconds: event.durationSeconds ?? t.durationSeconds,
                          }
                        : t,
                    ),
                  );
                }
              } catch {
                // Skip malformed lines
              }
            }
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось сгенерировать подкаст.",
          );
        } finally {
          if (!controller.signal.aborted) {
            setIsGenerating(false);
          }
        }
      })();
    },
    [isGenerating, allTopicIds, onComplete],
  );

  const reset = useCallback(() => {
    setTopicStatuses([]);
    setError(null);
    setCompletionMessage(null);
    setReadyCount(0);
    setFailedCount(0);
  }, []);

  return {
    topicStatuses,
    isGenerating,
    error,
    completionMessage,
    readyCount,
    failedCount,
    startGeneration,
    reset,
  };
}
