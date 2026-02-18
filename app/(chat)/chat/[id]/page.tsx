import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages, getChatUrl } from "@/lib/utils";

export default async function Page(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { id } = params;

  const session = await auth();

  if (!session) {
    console.log(`[Chat Page] No session, redirecting to login for chat ${id}`);
    redirect("/login");
  }

  const chat = await getChatById({ id });

  // New chat scenario: no chat in DB yet
  if (!chat) {
    console.log(`[Chat Page] Chat not found in DB: ${id}`);
    return notFound();
  }

  // ТЗ-RG: Redirect expertise/create chats to their route groups
  if (chat.chatMode === "expertise" || chat.chatMode === "create") {
    redirect(getChatUrl(id, chat.chatMode));
  }

  // Existing chat scenario
  if (chat.visibility === "private") {
    if (!session.user) {
      console.log(`[Chat Page] No session.user for private chat ${id}`);
      return notFound();
    }

    if (session.user.id !== chat.userId) {
      console.log(`[Chat Page] User mismatch: session=${session.user.id}, chat.userId=${chat.userId}`);
      return notFound();
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id,
  });

  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  // Use user's preference from cookie, or default to "auto" (agent-specific model)
  // "auto" mode will automatically select the best model for each agent
  const initialModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={initialModel}
        initialChatMode={chat.chatMode ?? "chat"}
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
      />
      <DataStreamHandler />
    </>
  );
}
