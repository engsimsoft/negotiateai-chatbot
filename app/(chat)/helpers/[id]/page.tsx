import { notFound, redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getHelperById } from "@/lib/helpers/server";

/**
 * /helpers/[id] — Страница помощника
 * Редирект на новый чат с этим помощником
 */
export default async function HelperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: helperId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Verify helper exists (preset or custom)
  const helper = await getHelperById(helperId);
  if (!helper) {
    notFound();
  }

  // For custom helpers, verify ownership
  if (helper.type === "custom" && helper.userId !== session.user.id) {
    notFound();
  }

  // Redirect to new chat with this helper
  redirect(`/helpers/${helperId}/chat`);
}
