import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getUserById, getBriefingSettings } from "@/lib/db/queries";
import { BriefingSetupClient } from "./briefing-setup-client";

/**
 * ТЗ-A2: Страница настройки брифинга
 *
 * Server Component: auth guard, mode detection (create/edit), userProfile.
 * Передаёт props в BriefingSetupClient.
 */
export default async function BriefingSetupRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;

  // Load user profile and briefing settings in parallel
  const [userProfile, settings] = await Promise.all([
    getUserById(userId),
    getBriefingSettings({ userId }),
  ]);

  // Mode detection: settings exist and active → edit, otherwise → create
  const briefingMode: "create" | "edit" =
    settings?.isActive ? "edit" : "create";

  return (
    <BriefingSetupClient
      briefingMode={briefingMode}
      userProfile={
        userProfile
          ? {
              displayName: userProfile.displayName,
              occupation: userProfile.occupation,
              bio: userProfile.bio,
              pronouns: userProfile.pronouns,
            }
          : undefined
      }
    />
  );
}
