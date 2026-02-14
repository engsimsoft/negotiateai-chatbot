"use client";

import Link from "next/link";
import { ChevronUp, LogOut, Moon, Settings, Sun, HelpCircle } from "lucide-react";
import type { User } from "next-auth";
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
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { fetcher } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

interface UserProfile {
  displayName: string | null;
  email: string;
  theme: string | null;
}

export function SidebarUserNav({ user }: { user: User }) {
  const { status } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { data: profile } = useSWR<UserProfile>("/api/user/profile", fetcher);

  const displayName =
    profile?.displayName || user?.email?.split("@")[0] || "";
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
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {status === "loading" ? (
              <SidebarMenuButton className="h-12 justify-between bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row gap-2">
                  <div className="size-8 animate-pulse rounded-full bg-muted" />
                  <div className="flex flex-col gap-1">
                    <span className="animate-pulse rounded-md bg-muted text-transparent text-sm">
                      Загрузка...
                    </span>
                  </div>
                </div>
                <div className="animate-spin text-muted-foreground">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="h-12 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {initial}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium" data-testid="user-email">
                      {displayName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Бесплатный
                    </span>
                  </div>
                </div>
                <ChevronUp className="ml-auto shrink-0" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings">
                <Settings className="mr-2 size-4" />
                Настройки
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="user-nav-item-theme"
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
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer"
                onClick={() => {
                  if (status === "loading") {
                    toast({
                      type: "error",
                      description:
                        "Проверка статуса авторизации, попробуйте ещё раз",
                    });
                    return;
                  }

                  signOut({
                    redirectTo: "/",
                  });
                }}
                type="button"
              >
                <LogOut className="mr-2 size-4" />
                Выйти
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
