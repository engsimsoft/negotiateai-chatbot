import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_PROJECT_MODEL, type ProjectModelTier } from "@/lib/ai/model-tiers";
import { getChatById, getMessagesByChatId, getProjectById } from "@/lib/db/queries";
import { convertToUIMessages } from "@/lib/utils";

export default async function ProjectChatPage({
  params,
}: {
  params: Promise<{ id: string; chatId: string }>;
}) {
  const { id: projectId, chatId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Verify project exists and belongs to user
  const project = await getProjectById({ id: projectId });
  if (!project) {
    notFound();
  }

  if (project.userId !== session.user.id) {
    notFound();
  }

  // Get chat and verify it belongs to this project
  const chat = await getChatById({ id: chatId });
  if (!chat) {
    notFound();
  }

  if (chat.projectId !== projectId) {
    notFound();
  }

  if (chat.userId !== session.user.id) {
    notFound();
  }

  const messagesFromDb = await getMessagesByChatId({ id: chatId });
  const uiMessages = convertToUIMessages(messagesFromDb);

  const cookieStore = await cookies();
  const modelTierFromCookie = cookieStore.get("project-model-tier");
  const initialModelTier = (modelTierFromCookie?.value as ProjectModelTier) || DEFAULT_PROJECT_MODEL;

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
        projectId={projectId}
        projectName={project.name}
        projectModelTier={initialModelTier}
      />
      <DataStreamHandler />
    </>
  );
}
