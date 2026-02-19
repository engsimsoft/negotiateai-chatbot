import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";

export function BriefingHeader() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="size-5" />
          </Button>
        </Link>
        <h1 className="font-serif text-lg font-semibold">
          ☀️ Утренний брифинг
        </h1>
      </div>

      <UserMenu />
    </header>
  );
}
