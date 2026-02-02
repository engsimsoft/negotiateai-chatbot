import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
import {
  DashboardHeader,
  DashboardGreeting,
  ToolsGrid,
  BenHint,
} from "@/components/dashboard";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Get user profile from database
  const userProfile = await getUserById(session.user.id);
  const displayName = userProfile?.displayName || session.user.email?.split("@")[0] || "друг";

  return (
    <div className="flex min-h-svh flex-col">
      <DashboardHeader />

      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4 lg:p-6">
        <DashboardGreeting displayName={displayName} />
        <ToolsGrid />
        <BenHint />
      </main>
    </div>
  );
}
