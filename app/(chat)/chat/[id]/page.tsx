import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getAgentById, getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages, generateUUID } from "@/lib/utils";

export default async function Page(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ agentId?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { id } = params;
  const { agentId } = searchParams;

  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  const chat = await getChatById({ id });

  // New chat scenario: no chat in DB yet, but agentId provided
  if (!chat) {
    if (!agentId) {
      // No chat and no agentId = invalid URL
      return notFound();
    }

    // This is a new chat that will be created on first message
    const cookieStore = await cookies();
    const chatModelFromCookie = cookieStore.get("chat-model");

    // Use user's preference from cookie, or default to "auto" (agent-specific model)
    const initialModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

    // Get agent greeting message for new chats
    const agent = await getAgentById({ id: agentId });
    const greetingMessages = agent?.greeting
      ? [
          {
            id: generateUUID(),
            role: "assistant" as const,
            parts: [{ type: "text" as const, text: agent.greeting }],
            createdAt: new Date(),
          },
        ]
      : [];

    return (
      <>
        <Chat
          autoResume={false}
          id={id}
          initialChatModel={initialModel}
          initialMessages={greetingMessages}
          initialVisibilityType="private"
          isReadonly={false}
          agentId={agentId}
        />
        <DataStreamHandler />
      </>
    );
  }

  // Existing chat scenario
  if (chat.visibility === "private") {
    if (!session.user) {
      return notFound();
    }

    if (session.user.id !== chat.userId) {
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
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session?.user?.id !== chat.userId}
        agentId={chat.agentId ?? undefined}
      />
      <DataStreamHandler />
    </>
  );
}
