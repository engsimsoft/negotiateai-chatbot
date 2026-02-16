import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { chatModeSchema } from "@/lib/ai/chat-mode-config";
import { generateUUID } from "@/lib/utils";

export default async function NewChatPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Generate new chat ID
  const id = generateUUID();

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");
  const initialModel = chatModelFromCookie?.value || DEFAULT_CHAT_MODEL;

  // ТЗ-DV2: Read ?mode= query param for chatMode
  const params = await searchParams;
  const parsedMode = chatModeSchema.safeParse(params.mode);
  const initialChatMode = parsedMode.success ? parsedMode.data : "chat";

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialChatModel={initialModel}
        initialChatMode={initialChatMode}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
      />
      <DataStreamHandler />
    </>
  );
}
