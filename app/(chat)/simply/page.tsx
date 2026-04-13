import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { getOrCreateSimplyChat, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

// ТЗ-LegacyChatCleanup: см. expertise/[id]/page.tsx
const INITIAL_CHAT_MODEL = "auto";

/**
 * ТЗ-KITT: Persistent "Simply" chat page.
 * Always loads the same chat for the authenticated user.
 * No chat ID in URL — one chat per user, always.
 */
export default async function SimplyPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const simplyChat = await getOrCreateSimplyChat(session.user.id);

  const messagesFromDb = await getMessagesByChatId({
    id: simplyChat.id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  return (
    <>
      <Chat
        autoResume={true}
        id={simplyChat.id}
        initialChatModel={INITIAL_CHAT_MODEL}
        initialChatMode="simply"
        initialLastContext={simplyChat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={simplyChat.visibility}
        isReadonly={false}
      />
      <DataStreamHandler />
    </>
  );
}
