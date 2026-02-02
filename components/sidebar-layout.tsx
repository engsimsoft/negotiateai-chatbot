"use client";

import { useState } from "react";
import type { User } from "next-auth";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTabs, type SidebarTab } from "@/components/sidebar-tabs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface SidebarLayoutProps {
  user: User | undefined;
  defaultOpen: boolean;
  children: React.ReactNode;
}

/**
 * Client component wrapper that manages sidebar tabs state.
 * SidebarTabs are rendered OUTSIDE of Sidebar to remain visible when collapsed.
 *
 * Layout structure:
 * - SidebarTabs: fixed left-0, w-12 (always visible)
 * - Sidebar: offset by --sidebar-left-offset (collapsible, see ui/sidebar.tsx)
 * - SidebarInset: main content area with pl-12 offset for tabs
 */
export function SidebarLayout({ user, defaultOpen, children }: SidebarLayoutProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("chats");

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* Tabs - fixed position, always visible on desktop */}
      <div className="fixed inset-y-0 left-0 z-20 hidden w-12 flex-col border-r bg-sidebar md:flex">
        <SidebarTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="border-r-0 bg-transparent"
        />
      </div>

      {/* Sidebar - uses --sidebar-left-offset from ui/sidebar.tsx */}
      <AppSidebar user={user} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main content - offset by tabs width (w-12 = 3rem) */}
      <SidebarInset className="md:pl-12">{children}</SidebarInset>
    </SidebarProvider>
  );
}
