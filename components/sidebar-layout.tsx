"use client";

import type { User } from "next-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface SidebarLayoutProps {
  user: User | undefined;
  defaultOpen: boolean;
  children: React.ReactNode;
}

/**
 * Sidebar Layout (ТЗ-07A: упрощённый без табов)
 *
 * Контекстный sidebar показывает чаты в зависимости от URL:
 * - /chat/* → общие чаты
 * - /projects/[id]/chat/* → чаты проекта
 * - /helpers/[id]/* → чаты помощника
 */
export function SidebarLayout({ user, defaultOpen, children }: SidebarLayoutProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar user={user} />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
