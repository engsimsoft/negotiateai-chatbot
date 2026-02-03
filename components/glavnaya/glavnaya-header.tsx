"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BenTrigger, BenDrawer } from "@/components/modal-assistants";
import { fetcher } from "@/lib/utils";
import { toast } from "@/components/toast";

interface UserProfile {
  displayName: string | null;
  email: string;
}

export function GlavnayaHeader() {
  const { status, data: session } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);

  const [benOpen, setBenOpen] = useState(false);

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

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      {/* Logo */}
      <Link href="/dashboard" className="text-xl font-bold tracking-tight">
        Simply
      </Link>

      {/* Right side actions */}
      <div className="ml-auto flex items-center gap-2">
        {/* Ben trigger */}
        <BenTrigger onClick={() => setBenOpen(true)} />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              {status === "loading" ? (
                <div className="size-8 animate-pulse rounded-full bg-zinc-500/30" />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {initial}
                </div>
              )}
              <ChevronDown className="size-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {status !== "loading" && (
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {session?.user?.email}
                </p>
              </div>
            )}
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
                if (status === "loading") {
                  toast({
                    type: "error",
                    description: "Проверка статуса авторизации, попробуйте ещё раз",
                  });
                  return;
                }
                signOut({ redirectTo: "/" });
              }}
            >
              <LogOut className="mr-2 size-4" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Ben drawer */}
      <BenDrawer open={benOpen} onOpenChange={setBenOpen} />
    </header>
  );
}
