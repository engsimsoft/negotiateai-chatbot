import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence } from "framer-motion";
import { memo, useEffect, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { useDataStream } from "./data-stream-provider";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

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

          return (
            <div key={message.id}>
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

  // Props are equal, skip re-render
  return true;
});
