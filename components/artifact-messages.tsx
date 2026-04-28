import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { AnimatePresence } from "framer-motion";
import { memo, useEffect, useState } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import type { UIArtifact } from "./artifact";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./elements/conversation";
import { PreviewMessage, ThinkingMessage } from "./message";

type ArtifactMessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  votes: Vote[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  artifactStatus: UIArtifact["status"];
};

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

function PureArtifactMessages({
  chatId,
  status,
  votes,
  messages,
  setMessages,
  regenerate,
  isReadonly,
}: ArtifactMessagesProps) {
  const [hasSentMessage, setHasSentMessage] = useState(false);
  useEffect(() => {
    if (status === "submitted") {
      setHasSentMessage(true);
    }
  }, [status]);

  return (
    <Conversation className="flex w-full flex-1 flex-col gap-4">
      <ScrollToBottomOnSubmit status={status} />
      <ConversationContent className="flex flex-col items-center gap-4 px-4 pt-20">
        {messages.map((message, index) => (
          <PreviewMessage
            chatId={chatId}
            isLoading={status === "streaming" && index === messages.length - 1}
            isReadonly={isReadonly}
            key={message.id}
            message={message}
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
        ))}

        <AnimatePresence mode="wait">
          {status === "submitted" && <ThinkingMessage key="thinking" />}
        </AnimatePresence>

        <div className="min-h-6 min-w-6 shrink-0" />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

function areEqual(
  prevProps: ArtifactMessagesProps,
  nextProps: ArtifactMessagesProps
) {
  if (
    prevProps.artifactStatus === "streaming" &&
    nextProps.artifactStatus === "streaming"
  ) {
    return true;
  }

  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.status && nextProps.status) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.votes, nextProps.votes)) {
    return false;
  }

  return true;
}

export const ArtifactMessages = memo(PureArtifactMessages, areEqual);
