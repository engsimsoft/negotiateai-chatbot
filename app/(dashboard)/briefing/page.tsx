import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getBriefingHistory } from "@/lib/db/queries";
import type { BriefingJSON } from "@/lib/briefing/briefing-types";
import { BriefingPage } from "@/components/briefing/briefing-page";

export default async function BriefingRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const history = await getBriefingHistory({
    userId: session.user.id,
    limit: 1,
  });

  // Find latest ready briefing
  const latest = history.find((h) => h.status === "ready");
  const briefing = latest
    ? (latest.briefingJson as BriefingJSON)
    : null;

  return <BriefingPage briefing={briefing} />;
}
