"use client";

import { Search, MessageSquare, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export type SidebarTab = "search" | "chats" | "projects";

interface SidebarTabsProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  className?: string;
}

const tabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "search", label: "Поиск", icon: <Search className="size-5" /> },
  { id: "chats", label: "Чаты", icon: <MessageSquare className="size-5" /> },
  { id: "projects", label: "Проекты", icon: <FolderOpen className="size-5" /> },
];

export function SidebarTabs({ activeTab, onTabChange, className }: SidebarTabsProps) {
  return (
    <div className={cn("flex w-12 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-2", className)}>
      {/* Tab buttons */}
      {tabs.map((tab) => (
        <Tooltip key={tab.id}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex size-10 items-center justify-center rounded-md transition-colors",
                activeTab === tab.id
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              {tab.icon}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {tab.label}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
