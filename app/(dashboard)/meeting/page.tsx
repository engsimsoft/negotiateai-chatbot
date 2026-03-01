import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { UserMenu } from "@/components/user-menu";
import { MeetingPage as MeetingPageClient } from "@/components/meeting/meeting-page";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function MeetingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-14 items-center border-b bg-background px-4 lg:px-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>
        <h1 className="ml-3 font-serif text-base font-semibold">
          Запись встречи
        </h1>
        <div className="ml-auto">
          <UserMenu align="end" />
        </div>
      </header>

      {/* Content */}
      <MeetingPageClient />
    </div>
  );
}
