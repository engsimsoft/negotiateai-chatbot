import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { UserMenu } from "@/components/user-menu";
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

      {/* Content — placeholder for Этап 2 */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="text-center">
          <span className="text-5xl">🎙️</span>
          <h2 className="mt-4 font-serif text-xl font-semibold">
            Запись встречи
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Запишите или загрузите аудио встречи и получите готовый протокол
          </p>
        </div>
      </main>
    </div>
  );
}
