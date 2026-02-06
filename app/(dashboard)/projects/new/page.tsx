import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
import { redirect } from "next/navigation";
import { ProjectCreationClient } from "./project-creation-client";

/**
 * ТЗ-09: Страница создания проекта через ServiceChat
 *
 * Полноэкранный диалог с Simply для создания нового проекта.
 * Simply знает профиль пользователя и задаёт уточняющие вопросы.
 */
export default async function NewProjectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Получить профиль пользователя для контекста
  const userProfile = await getUserById(session.user.id!);

  return (
    <ProjectCreationClient
      userProfile={
        userProfile
          ? {
              displayName: userProfile.displayName,
              occupation: userProfile.occupation,
              bio: userProfile.bio,
            }
          : undefined
      }
    />
  );
}
