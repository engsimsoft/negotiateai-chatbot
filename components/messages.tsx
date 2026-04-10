import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import type { SnapshotMeta, Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";
import { SnapshotDivider } from "./projects/snapshot-card";

/**
 * Check if a message contains a tool-createSnapshot part with output.
 */
function hasSnapshotToolCall(message: ChatMessage): boolean {
  return message.parts.some(
    (p) => (p as any).type === "tool-createSnapshot" && (p as any).state === "output-available"
  );
}

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  selectedModelId: string;
  onActionButton?: (payload: string) => void;
  /** ТЗ-C1.5: Snapshot metadata from Chat.snapshots[] (for fallback dividers) */
  snapshots?: SnapshotMeta[];
};

/**
 * ТЗ-1 hotfix: Internal sub-component that lives inside <Conversation> and
 * triggers scroll-to-bottom via `useStickToBottomContext()` when the chat
 * status becomes "submitted". Must be a child of <Conversation> because the
 * context hook only works inside <StickToBottom>.
 */
function ScrollToBottomOnSubmit({
  status,
}: {
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const { scrollToBottom } = useStickToBottomContext();
  useEffect(() => {
    if (status === "submitted") {
      scrollToBottom();
    }
  }, [status, scrollToBottom]);
  return null;
}

function PureMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
  selectedModelId,
  onActionButton,
  snapshots,
}: MessagesProps) {
  const { dataStream } = useDataStream();

  // Track whether user has sent a message in this session — used to add
  // bottom padding to the last assistant message while streaming.
  const [hasSentMessage, setHasSentMessage] = useState(false);
  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  // ТЗ-C1.5: Find the last snapshot boundary for dimming old messages
  // Priority 1: tool-created snapshot (visible in message parts)
  // Priority 2: fallback snapshot (from snapshots[] prop, no tool call in messages)
  const lastSnapshotIndex = useMemo(() => {
    // Find last message with tool-createSnapshot
    for (let i = messages.length - 1; i >= 0; i--) {
      if (hasSnapshotToolCall(messages[i])) {
        return i;
      }
    }
    return -1;
  }, [messages]);

  // Fallback snapshot: snapshot in Chat.snapshots[] whose messageId is NOT in messages
  const fallbackSnapshotInsertIndex = useMemo(() => {
    if (lastSnapshotIndex >= 0 || !snapshots?.length) return -1;

    const messageIds = new Set(messages.map((m) => m.id));
    // Find the latest fallback snapshot (not present as a message)
    const fallback = [...snapshots]
      .reverse()
      .find((s) => !messageIds.has(s.messageId));

    if (!fallback) return -1;

    // Insert divider after the last message created before the snapshot
    const snapshotTime = new Date(fallback.createdAt).getTime();
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTime = new Date(messages[i].metadata?.createdAt ?? 0).getTime();
      if (msgTime <= snapshotTime) {
        return i;
      }
    }

    // Snapshot is older than all messages — place at the beginning
    return 0;
  }, [messages, snapshots, lastSnapshotIndex]);

  // The effective dimming boundary: messages at or before this index are dimmed
  const dimBoundary = lastSnapshotIndex >= 0 ? lastSnapshotIndex : fallbackSnapshotInsertIndex;

  return (
    // ТЗ-1 hotfix: canonical single-scroll layout via <Conversation> (StickToBottom).
    // Previous version wrapped <Conversation> in an outer flex-col-reverse overflow-y-scroll
    // div, which created a DOUBLE-SCROLL container (outer manual + inner StickToBottom) —
    // causing a scrollbar that drifted/jittered on short messages. Removed entirely.
    // Scroll-to-bottom on submit: handled by <ScrollToBottomOnSubmit/> sub-component.
    // Scroll button: <ConversationScrollButton/> uses useStickToBottomContext natively.
    <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-1 flex-col gap-4 md:gap-6">
      <ScrollToBottomOnSubmit status={status} />
      <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
        {messages.length === 0 && <Greeting />}

        {messages.map((message, index) => {
          const isStreamingMessage =
            status === "streaming" && messages.length - 1 === index;
          const isDimmed = dimBoundary >= 0 && index < dimBoundary;

          return (
            <div key={message.id}>
              {/* ТЗ-C1.5: Fallback snapshot divider (no card, just divider) */}
              {fallbackSnapshotInsertIndex === index && lastSnapshotIndex < 0 && (
                <SnapshotDivider label="Контекст сжат" />
              )}

              <div className={isDimmed ? "opacity-50 transition-opacity" : undefined}>
                <PreviewMessage
                  chatId={chatId}
                  isLoading={isStreamingMessage}
                  isReadonly={isReadonly}
                  message={message}
                  onActionButton={onActionButton}
                  regenerate={regenerate}
                  requiresScrollPadding={
                    hasSentMessage && index === messages.length - 1
                  }
                  setMessages={setMessages}
                  vote={
                    votes
                      ? votes.find((vote) => vote.messageId === message.id)
                      : undefined
                  }
                />
              </div>
            </div>
          );
        })}

        <AnimatePresence mode="wait">
          {(status === "submitted" ||
            (status === "streaming" &&
             messages.length > 0 &&
             messages[messages.length - 1].role === "assistant" &&
             messages[messages.length - 1].parts.every(p => p.type !== "text" || !p.text?.trim()) &&
             // ТЗ-07: Don't show ThinkingMessage when tool activity indicator is already visible
             !dataStream.some(p => p.type === "data-tool-activity")
            )
          ) && <ThinkingMessage key="thinking" />}
        </AnimatePresence>

        <div className="min-h-6 min-w-6 shrink-0" />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  // Re-render if status changed
  if (prevProps.status !== nextProps.status) {
    return false;
  }

  // Re-render if model changed
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }

  // Re-render if messages array length changed
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }

  // Re-render if messages content changed
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }

  // Re-render if votes changed
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  // ТЗ-C1.5: Re-render if snapshots changed (for fallback dividers)
  if (!equal(prevProps.snapshots, nextProps.snapshots)) {
    return false;
  }

  // Props are equal, skip re-render
  return true;
});
