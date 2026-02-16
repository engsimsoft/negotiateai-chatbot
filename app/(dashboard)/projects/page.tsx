import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";
import { getProjectsWithStats } from "@/lib/db/queries";
import { ProjectsPageContent } from "@/components/projects/projects-page-content";

export default async function ProjectsPage() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  const projects = await getProjectsWithStats({ userId: session.user.id });

  return <ProjectsPageContent initialProjects={projects} />;
}
