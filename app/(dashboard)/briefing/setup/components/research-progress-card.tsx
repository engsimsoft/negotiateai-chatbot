"use client";

/**
 * Research Progress Card
 *
 * Shows live progress of startResearch per topic:
 * searching → verifying (N found) → done (M verified) / error
 *
 * ТЗ-FIX2 Этап 3: Client Progress UI
 */

import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export interface TopicProgress {
  topicId: string;
  topicName: string;
  emoji: string;
  phase: "searching" | "verifying" | "done" | "error";
  found?: number;
  verified?: number;
  error?: string;
}

const PHASE_LABELS: Record<TopicProgress["phase"], string> = {
  searching: "Ищу источники…",
  verifying: "Проверяю…",
  done: "Готово",
  error: "Ошибка",
};

interface ResearchProgressCardProps {
  topics: TopicProgress[];
}

export function ResearchProgressCard({ topics }: ResearchProgressCardProps) {
  if (topics.length === 0) return null;

  const allFinished = topics.every(
    (t) => t.phase === "done" || t.phase === "error",
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className="flex gap-3"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        S
      </div>
      <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-muted px-4 py-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          {allFinished ? "Источники найдены" : "Исследую источники"}
        </p>
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {topics.map((topic) => (
              <motion.div
                key={topic.topicId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="flex items-center gap-2 text-sm"
              >
                <span className="shrink-0">{topic.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{topic.topicName}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {topic.phase === "searching" && (
                    <Loader2 className="size-3 animate-spin" />
                  )}
                  {topic.phase === "verifying" && (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      <span>{topic.found} найдено</span>
                    </>
                  )}
                  {topic.phase === "done" && (
                    <span className="text-foreground">
                      ✓ {topic.verified} источн.
                    </span>
                  )}
                  {topic.phase === "error" && (
                    <span className="text-destructive">ошибка</span>
                  )}
                  {(topic.phase === "searching" || (topic.phase === "verifying" && !topic.found)) && (
                    <span>{PHASE_LABELS[topic.phase]}</span>
                  )}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* After all topics done: show "analyzing" indicator so user knows work continues */}
        {allFinished && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.3 }}
            className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3 text-xs text-muted-foreground"
          >
            <Loader2 className="size-3 animate-spin" />
            <span>Анализирую и готовлю ответ…</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
