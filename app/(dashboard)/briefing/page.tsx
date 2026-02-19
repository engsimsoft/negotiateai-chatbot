import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  getBriefingSettings,
  getBriefingHistory,
} from "@/lib/db/queries";
import { BriefingPage } from "@/components/briefing/briefing-page";
import { BriefingActivePage } from "@/components/briefing/briefing-active-page";

export default async function BriefingRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const settings = await getBriefingSettings({ userId });

  // ТЗ-А2: профиль активен → показываем выпуск / заглушку, нет → лендинг
  if (!settings?.isActive) {
    return <BriefingPage />;
  }

  const historyRows = await getBriefingHistory({ userId, limit: 1 });
  const latestBriefing = historyRows.find((h) => h.status === "ready") ?? null;

  return <BriefingActivePage briefing={latestBriefing} />;
}
