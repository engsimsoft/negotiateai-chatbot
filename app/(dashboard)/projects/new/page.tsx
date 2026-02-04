import { auth } from "@/app/(auth)/auth";
import { UniversalDialog } from "@/components/universal-dialog";
import { getUserById } from "@/lib/db/queries";
import { redirect } from "next/navigation";

/**
 * ТЗ-07A: Страница создания проекта через Universal Dialog
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
    <UniversalDialog
      context={{
        type: "create-project",
        userProfile: userProfile
          ? {
              displayName: userProfile.displayName,
              occupation: userProfile.occupation,
              bio: userProfile.bio,
            }
          : undefined,
      }}
    />
  );
}
