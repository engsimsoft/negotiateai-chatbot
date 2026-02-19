import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { BriefingPage } from "@/components/briefing/briefing-page";

export default async function BriefingRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // ТЗ-А1: всегда показываем лендинг
  // ТЗ-А2 добавит ветвление: настройки есть → выпуск, нет → лендинг
  return <BriefingPage />;
}
