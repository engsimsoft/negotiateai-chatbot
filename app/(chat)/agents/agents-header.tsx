"use client";

import { SidebarToggle } from "@/components/sidebar-toggle";

interface AgentsHeaderProps {
  title: string;
  backLink?: { href: string; label: string };
}

export function AgentsHeader({ title, backLink }: AgentsHeaderProps) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
      <SidebarToggle />
      {backLink ? (
        <a
          href={backLink.href}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {backLink.label}
        </a>
      ) : (
        <h1 className="text-lg font-semibold">{title}</h1>
      )}
    </header>
  );
}
