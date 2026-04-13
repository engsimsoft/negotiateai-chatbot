import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { getChatById, getMessagesByChatId } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

// ТЗ-LegacyChatCleanup: cookie `chat-model` и DEFAULT_CHAT_MODEL — артефакты старого
// UI-селектора моделей. Сейчас модель резолвится сервером через getModel(taskId),
// проп `initialChatModel` сохраняется в Chat → ModelSelectorCompact только для проектов.
// Для не-проектов передаём константу "auto".
const INITIAL_CHAT_MODEL = "auto";

export default async function ExpertiseChatPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const { id } = params;

  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const chat = await getChatById({ id });

  // New expertise chat: no chat in DB yet — render empty Chat component
  if (!chat) {
    return (
      <>
        <Chat
          autoResume={false}
          id={id}
          initialChatModel={INITIAL_CHAT_MODEL}
          initialChatMode="expertise"
          initialMessages={[]}
          initialVisibilityType="private"
          isReadonly={false}
        />
        <DataStreamHandler />
      </>
    );
  }

  // Existing chat: verify ownership
  if (chat.visibility === "private" && session.user.id !== chat.userId) {
    return notFound();
  }

  const messagesFromDb = await getMessagesByChatId({ id });
  const uiMessages = convertToUIMessages(messagesFromDb);

  return (
    <>
      <Chat
        autoResume={true}
        id={chat.id}
        initialChatModel={INITIAL_CHAT_MODEL}
        initialChatMode="expertise"
        initialLastContext={chat.lastContext ?? undefined}
        initialMessages={uiMessages}
        initialVisibilityType={chat.visibility}
        isReadonly={session.user.id !== chat.userId}
      />
      <DataStreamHandler />
    </>
  );
}
