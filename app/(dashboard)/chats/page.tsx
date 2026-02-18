import { MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getGeneralChatsWithStats } from "@/lib/db/queries";
import { ModeChatsPage } from "@/components/chats/mode-chats-page";

export default async function ChatsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const chats = await getGeneralChatsWithStats({ userId: session.user.id });

  return (
    <ModeChatsPage
      title="История чатов"
      createButton={{ label: "Новый чат", href: "/chat" }}
      emptyState={{
        icon: <MessageSquare className="size-8 text-muted-foreground" />,
        title: "Нет чатов",
        description:
          "Здесь будут отображаться ваши чаты. Начните разговор с AI на главной странице.",
      }}
      initialChats={chats}
    />
  );
}
