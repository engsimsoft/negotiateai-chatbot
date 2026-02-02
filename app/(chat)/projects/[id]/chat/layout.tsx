import { notFound, redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getProjectById, getFilesByProjectId } from "@/lib/db/queries";
import { ProjectContextPanel } from "@/components/projects/project-context-panel";

export default async function ProjectChatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const project = await getProjectById({ id: projectId });
  if (!project) {
    notFound();
  }

  if (project.userId !== session.user.id) {
    notFound();
  }

  const files = await getFilesByProjectId({ projectId });

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 min-w-0">
        {children}
      </div>

      {/* Right panel - project context */}
      <ProjectContextPanel project={project} files={files} />
    </div>
  );
}
