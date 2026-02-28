// ТЗ-TG5: /groups — страница групп Telegram

import { Users } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getTelegramGroupsByOwner } from "@/lib/db/queries";
import { GroupsPage } from "@/components/groups/groups-page";

export default async function GroupsRoute() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const groups = await getTelegramGroupsByOwner({
    ownerUserId: session.user.id,
  });

  return (
    <GroupsPage
      initialGroups={groups}
      emptyState={{
        icon: <Users className="size-8 text-muted-foreground" />,
        title: "Нет подключённых групп",
        description:
          "Добавьте @GetSimplyBot в вашу группу в Telegram — она появится здесь автоматически.",
      }}
    />
  );
}
