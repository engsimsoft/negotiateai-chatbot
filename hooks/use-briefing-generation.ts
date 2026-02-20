// ТЗ-А5: Hook for briefing generation with streaming progress

"use client";

import { useState, useCallback, useRef } from "react";
import type { BriefingProgressEvent } from "@/lib/briefing/briefing-types";

export interface BriefingGenerationStep {
  step: BriefingProgressEvent["step"];
  message: string;
  done: boolean;
  detail?: string;
}

interface UseBriefingGenerationReturn {
  steps: BriefingGenerationStep[];
  isGenerating: boolean;
  error: string | null;
  redirectUrl: string | null;
  startGeneration: () => void;
  reset: () => void;
}

export function useBriefingGeneration(): UseBriefingGenerationReturn {
  const [steps, setSteps] = useState<BriefingGenerationStep[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback(() => {
    if (isGenerating) return;

    // Reset state
    setSteps([]);
    setError(null);
    setRedirectUrl(null);
    setIsGenerating(true);

    // Abort any previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const response = await fetch("/api/briefing/generate", {
          method: "POST",
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("Failed to start generation");
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
              const event: BriefingProgressEvent = JSON.parse(line);

              if (event.step === "error") {
                setError(event.message);
                setIsGenerating(false);
                return;
              }

              if (event.step === "complete") {
                setRedirectUrl(event.redirectUrl ?? "/briefing");
                setIsGenerating(false);
                return;
              }

              // Update or add step
              setSteps((prev) => {
                const idx = prev.findIndex((s) => s.step === event.step);
                const updated: BriefingGenerationStep = {
                  step: event.step,
                  message: event.message,
                  done: event.done ?? false,
                  detail: event.detail,
                };

                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updated;
                  return next;
                }
                return [...prev, updated];
              });
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
            : "Не удалось сгенерировать брифинг.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsGenerating(false);
        }
      }
    })();
  }, [isGenerating]);

  const reset = useCallback(() => {
    setSteps([]);
    setError(null);
    setRedirectUrl(null);
  }, []);

  return { steps, isGenerating, error, redirectUrl, startGeneration, reset };
}
