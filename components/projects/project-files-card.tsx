"use client";

import { useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  FileSpreadsheet,
  File,
  Trash2,
  Loader2,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { FileViewer, toViewerFile } from "@/components/file-viewer";
import type { ProjectFile, ProjectFolder } from "@/lib/db/schema";

interface ProjectFilesCardProps {
  projectId: string;
  files: ProjectFile[];
  folders: ProjectFolder[];
  /** Compact mode for narrow Pulse panel (~300px) — no outer border/rounded, smaller padding */
  compact?: boolean;
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="size-4 text-muted-foreground" />;
  if (mimeType.includes("pdf")) return <FileText className="size-4 text-red-500" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return <FileSpreadsheet className="size-4 text-green-500" />;
  return <File className="size-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * ТЗ-07C1: Карточка файлов проекта с папками
 */
export function ProjectFilesCard({
  projectId,
  files: initialFiles,
  folders: initialFolders,
  compact = false,
}: ProjectFilesCardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [files, setFiles] = useState(initialFiles);
  const [folders, setFolders] = useState(initialFolders);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(initialFolders.map((f) => f.id))
  );
  const [isUploading, setIsUploading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Folder creation
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolderLoading, setIsCreatingFolderLoading] = useState(false);

  // Folder editing
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [isEditingFolderLoading, setIsEditingFolderLoading] = useState(false);

  // Folder deletion
  const [folderToDelete, setFolderToDelete] = useState<ProjectFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  // File moving
  const [movingFileId, setMovingFileId] = useState<string | null>(null);

  // File viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFileIndex, setViewerFileIndex] = useState(0);
  const [viewerFiles, setViewerFiles] = useState<ProjectFile[]>([]);

  // Open file viewer
  const openFileViewer = (file: ProjectFile, filesInContext: ProjectFile[]) => {
    const index = filesInContext.findIndex((f) => f.id === file.id);
    setViewerFiles(filesInContext);
    setViewerFileIndex(index >= 0 ? index : 0);
    setViewerOpen(true);
  };

  // Group files by folder
  const filesByFolder = useMemo(() => {
    const map = new Map<string | null, ProjectFile[]>();
    map.set(null, []); // Root files

    for (const folder of folders) {
      map.set(folder.id, []);
    }

    for (const file of files) {
      const folderId = file.folderId;
      const existing = map.get(folderId) || [];
      existing.push(file);
      map.set(folderId, existing);
    }

    return map;
  }, [files, folders]);

  const rootFiles = filesByFolder.get(null) || [];

  // Get file count for folder (for delete confirmation)
  const getFileCountForFolder = (folderId: string) => {
    return (filesByFolder.get(folderId) || []).length;
  };

  // Toggle folder
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Upload files
  const uploadFiles = async (filesToUpload: FileList, targetFolderId?: string | null) => {
    setIsUploading(true);

    try {
      for (const file of Array.from(filesToUpload)) {
        const formData = new FormData();
        formData.append("file", file);
        if (targetFolderId) {
          formData.append("folderId", targetFolderId);
        }

        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          console.error("Upload failed:", await response.json());
          continue;
        }

        const newFile = await response.json();
        setFiles((prev) => [newFile, ...prev]);
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to upload files:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    await uploadFiles(selectedFiles);
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = e.dataTransfer.files;
    if (!droppedFiles || droppedFiles.length === 0) return;
    await uploadFiles(droppedFiles);
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    setDeletingFileId(fileId);

    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      router.refresh();
    } catch (error) {
      console.error("Failed to delete file:", error);
    } finally {
      setDeletingFileId(null);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolderLoading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to create folder");
      }

      const newFolder = await response.json();
      setFolders((prev) => [...prev, newFolder]);
      setExpandedFolders((prev) => new Set([...prev, newFolder.id]));
      setNewFolderName("");
      setIsCreatingFolder(false);
      router.refresh();
    } catch (error) {
      console.error("Failed to create folder:", error);
    } finally {
      setIsCreatingFolderLoading(false);
    }
  };

  // Start editing folder
  const startEditingFolder = (folder: ProjectFolder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  // Save folder edit
  const handleSaveFolder = async () => {
    if (!editingFolderId || !editingFolderName.trim()) return;

    setIsEditingFolderLoading(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/folders/${editingFolderId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editingFolderName.trim() }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to update folder");
      }

      setFolders((prev) =>
        prev.map((f) =>
          f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f
        )
      );
      setEditingFolderId(null);
      setEditingFolderName("");
      router.refresh();
    } catch (error) {
      console.error("Failed to update folder:", error);
    } finally {
      setIsEditingFolderLoading(false);
    }
  };

  // Cancel folder edit
  const cancelEditingFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  // Delete folder
  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    setIsDeletingFolder(true);

    try {
      const response = await fetch(
        `/api/projects/${projectId}/folders/${folderToDelete.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete folder");
      }

      // Move files to root in local state
      setFiles((prev) =>
        prev.map((f) =>
          f.folderId === folderToDelete.id ? { ...f, folderId: null } : f
        )
      );
      setFolders((prev) => prev.filter((f) => f.id !== folderToDelete.id));
      setFolderToDelete(null);
      router.refresh();
    } catch (error) {
      console.error("Failed to delete folder:", error);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // Move file to folder
  const handleMoveFile = async (fileId: string, targetFolderId: string | null) => {
    setMovingFileId(fileId);

    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: targetFolderId }),
      });

      if (!response.ok) {
        throw new Error("Failed to move file");
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, folderId: targetFolderId } : f))
      );
      router.refresh();
    } catch (error) {
      console.error("Failed to move file:", error);
    } finally {
      setMovingFileId(null);
    }
  };

  // File item component
  const FileItem = ({
    file,
    currentFolderId,
    filesInContext,
  }: {
    file: ProjectFile;
    currentFolderId: string | null;
    filesInContext: ProjectFile[];
  }) => (
    <div
      className="group flex cursor-pointer items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 transition-colors hover:bg-muted"
      onClick={() => openFileViewer(file, filesInContext)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFileViewer(file, filesInContext);
        }
      }}
    >
      {getFileIcon(file.mimeType)}
      <span className="flex-1 truncate text-sm">{file.name}</span>
      <span className="text-xs text-muted-foreground">
        {formatFileSize(file.size || 0)}
      </span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-0 group-hover:opacity-100 text-muted-foreground"
            disabled={movingFileId === file.id || deletingFileId === file.id}
          >
            {movingFileId === file.id || deletingFileId === file.id ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MoreHorizontal className="size-3.5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {folders.length > 0 && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderInput className="mr-2 size-4" />
                  Переместить в...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {currentFolderId !== null && (
                    <DropdownMenuItem onClick={() => handleMoveFile(file.id, null)}>
                      <Folder className="mr-2 size-4" />
                      Корень проекта
                    </DropdownMenuItem>
                  )}
                  {folders
                    .filter((f) => f.id !== currentFolderId)
                    .map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => handleMoveFile(file.id, folder.id)}
                      >
                        <Folder className="mr-2 size-4" />
                        {folder.emoji} {folder.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={() => handleDeleteFile(file.id)}
          >
            <Trash2 className="mr-2 size-4" />
            Удалить
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className={compact ? "px-4 py-3" : "rounded-xl border bg-background p-4"}>
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        {!compact && (
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Файлы ({files.length})
          </h3>
        )}
        <div className={compact ? "flex w-full gap-2" : "flex gap-2"}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setIsCreatingFolder(true)}
            disabled={isCreatingFolder}
          >
            <FolderPlus className="size-3.5" />
            Папка
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            accept=".pdf,.doc,.docx,.txt,.md,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.gif,.webp"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            Загрузить
          </Button>
        </div>
      </div>

      {/* New folder input */}
      {isCreatingFolder && (
        <div className="mb-3 flex items-center gap-2">
          <Folder className="size-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Название папки"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder();
              if (e.key === "Escape") {
                setIsCreatingFolder(false);
                setNewFolderName("");
              }
            }}
            className="h-8 flex-1"
            disabled={isCreatingFolderLoading}
          />
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim() || isCreatingFolderLoading}
          >
            {isCreatingFolderLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => {
              setIsCreatingFolder(false);
              setNewFolderName("");
            }}
            disabled={isCreatingFolderLoading}
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Folders and files */}
      <div className="space-y-2">
        {/* Folders */}
        {folders.map((folder) => {
          const folderFiles = filesByFolder.get(folder.id) || [];
          const isExpanded = expandedFolders.has(folder.id);
          const isEditing = editingFolderId === folder.id;

          return (
            <Collapsible
              key={folder.id}
              open={isExpanded}
              onOpenChange={() => toggleFolder(folder.id)}
            >
              <div className="rounded-lg border bg-muted/30">
                {/* Folder header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6">
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>

                  <span className="text-base">{folder.emoji}</span>

                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-2">
                      <Input
                        autoFocus
                        value={editingFolderName}
                        onChange={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveFolder();
                          if (e.key === "Escape") cancelEditingFolder();
                        }}
                        className="h-7 flex-1"
                        disabled={isEditingFolderLoading}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={handleSaveFolder}
                        disabled={!editingFolderName.trim() || isEditingFolderLoading}
                      >
                        {isEditingFolderLoading ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={cancelEditingFolder}
                        disabled={isEditingFolderLoading}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-sm font-medium">
                        {folder.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {folderFiles.length}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 text-muted-foreground"
                          >
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEditingFolder(folder)}>
                            <Pencil className="mr-2 size-4" />
                            Переименовать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setFolderToDelete(folder)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>

                {/* Folder content */}
                <CollapsibleContent>
                  <div className="space-y-1 px-3 pb-3">
                    {folderFiles.length > 0 ? (
                      folderFiles.map((file) => (
                        <FileItem
                          key={file.id}
                          file={file}
                          currentFolderId={folder.id}
                          filesInContext={folderFiles}
                        />
                      ))
                    ) : (
                      <div className="py-2 text-center text-xs text-muted-foreground">
                        Папка пуста
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* Root files (no folder) */}
        {rootFiles.length > 0 && (
          <div className="space-y-1">
            {folders.length > 0 && (
              <div className="px-1 py-1 text-xs font-medium text-muted-foreground">
                Без папки
              </div>
            )}
            {rootFiles.map((file) => (
              <FileItem
                key={file.id}
                file={file}
                currentFolderId={null}
                filesInContext={rootFiles}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && folders.length === 0 && !isCreatingFolder && (
          <div className="py-2 text-center text-sm text-muted-foreground">
            Нет загруженных файлов
          </div>
        )}
      </div>

      {/* Drop zone */}
      <div
        className={`mt-3 rounded-lg border border-dashed py-3 text-center text-sm cursor-pointer transition-colors ${
          isDragOver
            ? "border-primary bg-primary/5 text-primary"
            : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragOver ? "Отпустите для загрузки" : "Перетащите файлы сюда"}
      </div>

      {/* Delete folder confirmation */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(open) => !open && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить папку?</AlertDialogTitle>
            <AlertDialogDescription>
              Удалить папку «{folderToDelete?.emoji} {folderToDelete?.name}»?
              {getFileCountForFolder(folderToDelete?.id || "") > 0 && (
                <>
                  {" "}
                  {getFileCountForFolder(folderToDelete?.id || "")}{" "}
                  {getFileCountForFolder(folderToDelete?.id || "") === 1
                    ? "файл будет перемещён"
                    : getFileCountForFolder(folderToDelete?.id || "") < 5
                      ? "файла будут перемещены"
                      : "файлов будут перемещены"}{" "}
                  в корень проекта.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingFolder}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFolder}
              disabled={isDeletingFolder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingFolder ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Viewer */}
      {viewerFiles.length > 0 && (
        <FileViewer
          file={toViewerFile(viewerFiles[viewerFileIndex])}
          files={viewerFiles.map(toViewerFile)}
          currentIndex={viewerFileIndex}
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          onNavigate={(index) => setViewerFileIndex(index)}
        />
      )}
    </div>
  );
}
