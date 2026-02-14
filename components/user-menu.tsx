"use client";

import Link from "next/link";
import { LogOut, Moon, Settings, Sun } from "lucide-react";
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
import { toast } from "@/components/toast";

interface UserProfile {
  displayName: string | null;
  email: string;
}

interface UserMenuProps {
  /** Alignment of the dropdown relative to trigger. Default: "end" */
  align?: "start" | "end" | "center";
}

export function UserMenu({ align = "end" }: UserMenuProps) {
  const { status, data: session } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);

  const displayName =
    profile?.displayName || session?.user?.email?.split("@")[0] || "";
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
      <div className="size-8 animate-pulse rounded-full bg-muted shrink-0" />
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
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-48">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {session?.user?.email}
          </p>
        </div>
        <DropdownMenuSeparator />
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            signOut({ redirectTo: "/" });
          }}
        >
          <LogOut className="mr-2 size-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
