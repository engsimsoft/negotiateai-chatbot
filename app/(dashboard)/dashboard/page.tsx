import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getUserById, getGeneralChatsCount } from "@/lib/db/queries";
import {
  GlavnayaHeader,
  GlavnayaGreeting,
  GlavnayaInput,
  ModeCardsSection,
  ChatHistoryCard,
} from "@/components/glavnaya";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Get user profile and chat count from database
  const [userProfile, generalChatsCount] = await Promise.all([
    getUserById(session.user.id),
    getGeneralChatsCount({ userId: session.user.id }),
  ]);
  // User was deleted from DB but JWT still valid — force re-auth
  if (!userProfile) {
    const cookieStore = await cookies();
    cookieStore.delete("authjs.session-token");
    cookieStore.delete("__Secure-authjs.session-token");
    redirect("/login");
  }

  const displayName = userProfile.displayName || session.user.email?.split("@")[0] || "друг";

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <GlavnayaHeader />

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-10 lg:px-6">
        {/* Greeting + Input */}
        <section className="mb-12">
          <GlavnayaGreeting displayName={displayName} />
          <div className="flex items-stretch gap-3">
            {generalChatsCount > 0 && (
              <ChatHistoryCard count={generalChatsCount} />
            )}
            <GlavnayaInput />
          </div>
        </section>

        {/* Mode cards */}
        <ModeCardsSection />
      </main>
    </div>
  );
}
