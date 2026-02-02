import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_PROJECT_MODEL, type ProjectModelTier } from "@/lib/ai/model-tiers";
import { getProjectById } from "@/lib/db/queries";
import { generateUUID } from "@/lib/utils";

export default async function NewProjectChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const project = await getProjectById({ id: projectId });
  if (!project) {
    notFound();
  }

  if (project.userId !== session.user.id) {
    notFound();
  }

  // Generate new chat ID
  const chatId = generateUUID();

  const cookieStore = await cookies();
  const modelTierFromCookie = cookieStore.get("project-model-tier");
  const initialModelTier = (modelTierFromCookie?.value as ProjectModelTier) || DEFAULT_PROJECT_MODEL;

  return (
    <>
      <Chat
        autoResume={false}
        id={chatId}
        initialChatModel="auto"
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        projectId={projectId}
        projectName={project.name}
        projectModelTier={initialModelTier}
      />
      <DataStreamHandler />
    </>
  );
}
