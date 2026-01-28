"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const HINT_DISMISSED_KEY = "simply-chat-hint-dismissed";

/**
 * ТЗ-2: System hint for new users.
 * Shows a tip about @-mentions above the input field.
 * Dismissed state is persisted in localStorage.
 */
function PureChatHint({
  messagesCount,
  hasUsedMentions,
}: {
  messagesCount: number;
  hasUsedMentions: boolean;
}) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(HINT_DISMISSED_KEY);
    setDismissed(stored === "true");
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(HINT_DISMISSED_KEY, "true");
  }, []);

  // Don't show if: dismissed, user has used @-mentions, or chat already has messages
  if (dismissed || hasUsedMentions || messagesCount > 0) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
      <span className="shrink-0">💡</span>
      <p className="min-w-0 flex-1">
        Напишите <strong className="text-foreground">@Помощник</strong> чтобы
        узнать о возможностях платформы, или{" "}
        <strong className="text-foreground">@PromptAgent</strong> для помощи с
        формулировкой запроса.
      </p>
      <button
        aria-label="Закрыть подсказку"
        className="shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground"
        onClick={handleDismiss}
        type="button"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export const ChatHint = memo(PureChatHint);
