"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { FolderOpen, Plus, FileText, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { fetcher } from "@/lib/utils";

interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  fileCount: number;
  chatCount: number;
  updatedAt: string;
}

export function SidebarProjects() {
  const { setOpenMobile } = useSidebar();
  const params = useParams();
  const activeProjectId = params?.id as string | undefined;

  const { data: projects, isLoading } = useSWR<ProjectWithStats[]>(
    "/api/projects",
    fetcher
  );

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 64].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className="h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const hasProjects = projects && projects.length > 0;

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        {/* New project button */}
        <div className="mb-2 px-2">
          <CreateProjectDialog>
            <Button variant="outline" size="sm" className="w-full justify-start gap-2">
              <Plus className="size-4" />
              Новый проект
            </Button>
          </CreateProjectDialog>
        </div>

        {!hasProjects ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Организуйте работу в проектах
              </p>
            </div>
          </div>
        ) : (
          <SidebarMenu>
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  asChild
                  isActive={project.id === activeProjectId}
                >
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={() => setOpenMobile(false)}
                  >
                    <FolderOpen className="size-4 shrink-0" />
                    <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                      <span className="truncate">{project.name}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5">
                          <FileText className="size-3" />
                          {project.fileCount}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="size-3" />
                          {project.chatCount}
                        </span>
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}

            {/* Link to all projects */}
            <div className="mt-2 px-2">
              <Link
                href="/projects"
                onClick={() => setOpenMobile(false)}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Все проекты
              </Link>
            </div>
          </SidebarMenu>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
