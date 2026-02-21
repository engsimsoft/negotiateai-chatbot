// ТЗ-BF2: Mark simply-news as seen — updates User.lastSeenSimplyVersion

import { auth } from "@/app/(auth)/auth";
import { updateLastSeenSimplyVersion } from "@/lib/db/queries";
import { getSimplyNewsData } from "@/lib/briefing/simply-news-utils";

export async function PATCH() {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { meta } = getSimplyNewsData();

  await updateLastSeenSimplyVersion({
    userId: session.user.id,
    version: meta.version,
  });

  return Response.json({ version: meta.version });
}
