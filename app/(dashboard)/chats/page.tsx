import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getGeneralChatsWithStats } from "@/lib/db/queries";
import { ChatsPageContent } from "@/components/chats/chats-page-content";

export default async function ChatsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const chats = await getGeneralChatsWithStats({ userId: session.user.id });

  return <ChatsPageContent initialChats={chats} />;
}
