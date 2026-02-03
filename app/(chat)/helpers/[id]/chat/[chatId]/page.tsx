import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { getHelperById } from "@/lib/helpers/server";
import { convertToUIMessages } from "@/lib/utils";

/**
 * /helpers/[id]/chat/[chatId] — Существующий чат с помощником
 */
export default async function HelperChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id: helperId, chatId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Verify helper exists (preset or custom)
  const helper = await getHelperById(helperId);
  if (!helper) {
    notFound();
  }

  // For custom helpers, verify ownership
  if (helper.type === "custom" && helper.userId !== session.user.id) {
    notFound();
  }

  // Get chat and verify it belongs to this helper
  const chat = await getChatById({ id: chatId });
  if (!chat) {
    notFound();
  }

  if (chat.helperId !== helperId) {
    notFound();
  }

  if (chat.userId !== session.user.id) {
    notFound();
  }

  const messagesFromDb = await getMessagesByChatId({ id: chatId });
  const uiMessages = convertToUIMessages(messagesFromDb);

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel="auto"
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={false}
        helperId={helperId}
        helperName={helper.name}
        helperEmoji={helper.emoji}
      />
      <DataStreamHandler />
    </>
  );
}
