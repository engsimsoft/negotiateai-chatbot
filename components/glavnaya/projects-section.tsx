"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import useSWR from "swr";
import { SectionTitle } from "./section-title";
import { ProjectCard } from "@/components/projects/project-card";
import { fetcher } from "@/lib/utils";

interface ProjectWithStats {
  id: string;
  name: string;
  description: string | null;
  fileCount: number;
  chatCount: number;
  updatedAt: Date;
}

function NewProjectButton() {
  return (
    <Link
      href="/projects/new"
      className="flex min-h-[72px] items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      <Plus className="size-5" />
      Новый проект
    </Link>
  );
}

export function ProjectsSection() {
  const { data: projects, isLoading } = useSWR<ProjectWithStats[]>(
    "/api/projects",
    fetcher
  );

  if (isLoading) {
    return (
      <section className="mb-10">
        <SectionTitle>Проекты</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-xl bg-muted"
            />
          ))}
        </div>
      </section>
    );
  }

  const projectCount = projects?.length || 0;

  return (
    <section className="mb-10">
      <SectionTitle count={projectCount}>Проекты</SectionTitle>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
        <NewProjectButton />
      </div>
    </section>
  );
}
