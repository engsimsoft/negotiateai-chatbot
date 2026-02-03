import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getUserById } from "@/lib/db/queries";
import {
  GlavnayaHeader,
  GlavnayaGreeting,
  GlavnayaInput,
  ProjectsSection,
  HelpersSection,
  ToolsSection,
} from "@/components/glavnaya";

export default async function DashboardPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Get user profile from database
  const userProfile = await getUserById(session.user.id);
  const displayName = userProfile?.displayName || session.user.email?.split("@")[0] || "друг";

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <GlavnayaHeader />

      <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-10 lg:px-6">
        {/* Greeting + Input */}
        <section className="mb-12">
          <GlavnayaGreeting displayName={displayName} />
          <GlavnayaInput />
        </section>

        {/* Projects */}
        <ProjectsSection />

        {/* Helpers */}
        <HelpersSection />

        {/* Tools */}
        <ToolsSection />
      </main>
    </div>
  );
}
