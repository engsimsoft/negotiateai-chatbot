"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SidebarSearch() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Поиск по чатам..."
          className="pl-9"
          disabled
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground">
        <Search className="size-8 opacity-50" />
        <p>Поиск скоро будет доступен</p>
      </div>
    </div>
  );
}
