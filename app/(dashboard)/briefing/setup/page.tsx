import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/app/(auth)/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

export default async function BriefingSetupRoute() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Link href="/briefing">
            <Button size="icon" variant="ghost">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <h1 className="font-serif text-lg font-semibold">
            Настройка брифинга
          </h1>
        </div>
        <UserMenu />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <span className="mb-4 text-5xl">🔧</span>
        <h2 className="mb-2 font-serif text-xl font-semibold">
          Скоро здесь появится настройка
        </h2>
        <p className="mb-6 max-w-sm text-sm text-muted-foreground">
          Вы сможете выбрать темы, источники и расписание для вашего
          персонального брифинга.
        </p>
        <Link href="/briefing">
          <Button variant="outline">Вернуться</Button>
        </Link>
      </main>
    </div>
  );
}
