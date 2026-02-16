import { Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getChatsByModeWithStats } from "@/lib/db/queries";
import { ModeChatsPage } from "@/components/chats/mode-chats-page";

export default async function CreatePage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const chats = await getChatsByModeWithStats({
    userId: session.user.id,
    mode: "create",
  });

  return (
    <ModeChatsPage
      title="Создать"
      createButton={{ label: "Новый документ", href: "/chat?mode=create" }}
      emptyState={{
        icon: <Sparkles className="size-8 text-muted-foreground" />,
        title: "Нет документов",
        description:
          "Презентации, отчёты, изображения. Создайте что-то новое.",
      }}
      initialChats={chats}
    />
  );
}
