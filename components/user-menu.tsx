"use client";

import Link from "next/link";
import { LogOut, Moon, Settings, Sun, HelpCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fetcher } from "@/lib/utils";
import { toast } from "./toast";

interface UserProfile {
  displayName: string | null;
  email: string;
  theme: string | null;
}

/**
 * Compact global user menu (avatar + dropdown).
 * Used on pages without AppSidebar: (dashboard), (task).
 */
export function UserMenu() {
  const { status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);

  const displayName =
    profile?.displayName || profile?.email?.split("@")[0] || "";
  const initial = displayName.charAt(0).toUpperCase();

  const handleThemeToggle = async () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);

    try {
      await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {
      // Theme already applied locally
    }
  };

  if (status === "loading") {
    return (
      <div className="size-8 animate-pulse rounded-full bg-muted" />
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium transition-all hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/settings">
            <Settings className="mr-2 size-4" />
            Настройки
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={handleThemeToggle}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="mr-2 size-4" />
          ) : (
            <Moon className="mr-2 size-4" />
          )}
          {resolvedTheme === "dark" ? "Светлая тема" : "Тёмная тема"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            toast({
              type: "success",
              description: "Раздел помощи в разработке",
            });
          }}
        >
          <HelpCircle className="mr-2 size-4" />
          Помощь
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <button
            className="w-full cursor-pointer"
            onClick={() => {
              signOut({ redirectTo: "/" });
            }}
            type="button"
          >
            <LogOut className="mr-2 size-4" />
            Выйти
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
