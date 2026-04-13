import { Search } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getChatsByModeWithStats } from "@/lib/db/queries";
import { ModeChatsPage } from "@/components/chats/mode-chats-page";

export default async function ExpertisePage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const chats = await getChatsByModeWithStats({
    userId: session.user.id,
    mode: "expertise",
  });

  return (
    <ModeChatsPage
      title="Экспертиза"
      chatMode="expertise"
      createButton={{ label: "Новый запрос" }}
      emptyState={{
        icon: <Search className="size-8 text-muted-foreground" />,
        title: "Нет запросов",
        description:
          "Точные ответы с проверкой фактов. Начните новый запрос.",
      }}
      initialChats={chats}
      countNoun={{ one: "запрос", few: "запроса", many: "запросов" }}
      summaryLabel="О чём запрос"
      openLabel="Открыть запрос"
    />
  );
}
