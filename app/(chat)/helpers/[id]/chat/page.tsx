import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { getHelperById } from "@/lib/helpers/server";
import { generateUUID } from "@/lib/utils";

/**
 * /helpers/[id]/chat — Новый чат с помощником
 */
export default async function NewHelperChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: helperId } = await params;

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

  // Generate new chat ID
  const chatId = generateUUID();

  return (
    <>
      <Chat
        autoResume={false}
        id={chatId}
        initialChatModel="auto"
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        helperId={helperId}
        helperName={helper.name}
        helperEmoji={helper.emoji}
      />
      <DataStreamHandler />
    </>
  );
}
