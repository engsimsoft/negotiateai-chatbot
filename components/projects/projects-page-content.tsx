"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListDetailPage } from "@/components/list-detail";
import { ProjectListItem } from "./project-list-item";
import { ProjectDetailPanel } from "./project-detail-panel";

export type ProjectWithStats = {
  id: string;
  name: string;
  description: string | null;
  phase: string;
  fileCount: number;
  taskCount: number;
  updatedAt: Date;
};

function projectCountLabel(count: number): string {
  if (count === 1) return "проект";
  if (count >= 2 && count <= 4) return "проекта";
  return "проектов";
}

interface ProjectsPageContentProps {
  initialProjects: ProjectWithStats[];
}

export function ProjectsPageContent({
  initialProjects,
}: ProjectsPageContentProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectWithStats[]>(initialProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    initialProjects.length > 0 ? initialProjects[0].id : null
  );

  // Rename dialog state
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Delete dialog state (from detail panel)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedProject =
    projects.find((p) => p.id === selectedProjectId) || null;

  // Delete handler
  const handleDelete = async (projectId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        setDeleteProjectId(null);
        if (selectedProjectId === projectId) {
          const remaining = projects.filter((p) => p.id !== projectId);
          setSelectedProjectId(remaining.length > 0 ? remaining[0].id : null);
        }
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open rename dialog
  const handleOpenRename = (projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    setRenameProjectId(projectId);
    setNewName(proj.name);
  };

  // Submit rename
  const handleRename = async () => {
    if (!renameProjectId || !newName.trim()) return;
    const proj = projects.find((p) => p.id === renameProjectId);
    if (!proj || newName.trim() === proj.name) {
      setRenameProjectId(null);
      return;
    }

    setIsRenaming(true);
    try {
      const response = await fetch(`/api/projects/${renameProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (response.ok) {
        setProjects((prev) =>
          prev.map((p) =>
            p.id === renameProjectId ? { ...p, name: newName.trim() } : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to rename project:", error);
    } finally {
      setIsRenaming(false);
      setRenameProjectId(null);
    }
  };

  // Open delete from detail panel
  const handleOpenDelete = (projectId: string) => {
    setDeleteProjectId(projectId);
  };

  const deleteProject = deleteProjectId
    ? projects.find((p) => p.id === deleteProjectId)
    : null;

  return (
    <>
      <ListDetailPage
        title="Проекты"
        itemCount={projects.length}
        itemCountLabel={projectCountLabel}
        createButton={{ label: "Новый проект", href: "/projects/new" }}
        emptyState={{
          icon: <FolderOpen className="size-8 text-muted-foreground" />,
          title: "Нет проектов",
          description:
            "Создайте первый проект для организации работы с AI.",
        }}
        isEmpty={projects.length === 0}
        listContent={
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto">
              {projects.map((proj) => (
                <ProjectListItem
                  key={proj.id}
                  project={proj}
                  isSelected={proj.id === selectedProjectId}
                  onSelect={() => setSelectedProjectId(proj.id)}
                  onDelete={() => handleDelete(proj.id)}
                  onRename={() => handleOpenRename(proj.id)}
                />
              ))}
            </div>
          </div>
        }
        detailContent={
          <ProjectDetailPanel
            project={selectedProject}
            onDelete={handleOpenDelete}
            onRename={handleOpenRename}
          />
        }
      />

      {/* Rename dialog */}
      <Dialog
        open={renameProjectId !== null}
        onOpenChange={(open) => {
          if (!open) setRenameProjectId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать проект</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название проекта"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameProjectId(null)}
            >
              Отмена
            </Button>
            <Button
              onClick={handleRename}
              disabled={isRenaming || !newName.trim()}
            >
              {isRenaming && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog (from detail panel) */}
      <AlertDialog
        open={deleteProjectId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteProjectId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
            <AlertDialogDescription>
              Проект «{deleteProject?.name}» и все его задачи будут удалены
              безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => deleteProjectId && handleDelete(deleteProjectId)}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="size-4 mr-2 animate-spin" />
              )}
              Удалить
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
