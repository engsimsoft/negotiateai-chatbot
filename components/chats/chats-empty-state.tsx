"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function ChatsEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <MessageSquare className="size-8 text-muted-foreground" />
      </div>

      <h2 className="mb-2 text-lg font-semibold">Нет чатов</h2>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Здесь будут отображаться ваши чаты. Начните разговор с AI на главной странице.
      </p>

      <Button asChild>
        <Link href="/dashboard">На главную</Link>
      </Button>
    </div>
  );
}
