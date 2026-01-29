"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const HINT_DISMISSED_KEY = "simply-hint-guest-agent-seen";

/**
 * ТЗ-4: System hint for new users about guest agent calls.
 * Shows a tip about @-mentions as "consultations" that don't switch the chat.
 * Dismissed state is persisted in localStorage.
 * Can be shown again via forceShow prop.
 */
function PureChatHint({
  messagesCount,
  hasUsedMentions,
  forceShow,
  onDismiss,
}: {
  messagesCount: number;
  hasUsedMentions: boolean;
  forceShow?: boolean;
  onDismiss?: () => void;
}) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash

  useEffect(() => {
    const stored = localStorage.getItem(HINT_DISMISSED_KEY);
    setDismissed(stored === "true");
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(HINT_DISMISSED_KEY, "true");
    onDismiss?.();
  }, [onDismiss]);

  // Show if: forced, or (not dismissed AND not used mentions AND empty chat)
  const shouldShow = forceShow || (!dismissed && !hasUsedMentions && messagesCount === 0);

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
      <span className="shrink-0">💡</span>
      <p className="min-w-0 flex-1">
        Напишите <strong className="text-foreground">@Помощник</strong> или{" "}
        <strong className="text-foreground">@Маркетолог</strong> чтобы позвать
        другого агента прямо в этот чат. Он ответит и вы продолжите с текущим.
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
