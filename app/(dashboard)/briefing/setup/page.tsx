import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import {
  getUserById,
  getBriefingSettings,
  getBriefingTopics,
  getBriefingSources,
} from "@/lib/db/queries";
import { BriefingSetupClient } from "./briefing-setup-client";

/**
 * ТЗ-A2: Страница настройки брифинга
 *
 * Server Component: auth guard, mode detection (create/edit), userProfile.
 * Edit mode: загружает текущие topics/sources из БД для preview.
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

  // Edit mode: load current topics + sources for preview
  let initialProfile = undefined;
  if (briefingMode === "edit") {
    const [topics, sources] = await Promise.all([
      getBriefingTopics({ userId }),
      getBriefingSources({ userId }),
    ]);

    initialProfile = {
      topics: topics.map((t) => ({
        topicId: t.topicId,
        topicName: t.topicName,
        emoji: t.emoji,
        briefingStyle: t.briefingStyle ?? undefined,
      })),
      sources: sources.map((s) => ({
        topicId: s.topicId,
        sourceName: s.sourceName,
        sourceUrl: s.sourceUrl,
        rssUrl: s.rssUrl,
        fetchMethod: s.fetchMethod,
        sourceLanguage: s.sourceLanguage,
        tier: s.tier,
      })),
      settings: settings
        ? {
            language: settings.language ?? undefined,
            maxItems: settings.maxItems ?? undefined,
            volume: settings.volume ?? undefined,
          }
        : undefined,
    };
  }

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
      initialProfile={initialProfile}
    />
  );
}
