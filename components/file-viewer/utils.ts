import {
  File,
  FileText,
  FileSpreadsheet,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FileArchive,
  Presentation,
} from "lucide-react";
import type { FileType, ViewerFile } from "./types";

/**
 * Определить тип файла по contentType и расширению
 */
export function getFileType(file: Pick<ViewerFile, "contentType" | "name">): FileType {
  const mime = file.contentType?.toLowerCase() || "";
  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  // Images
  if (
    mime.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"].includes(ext)
  ) {
    return "image";
  }

  // PDF
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }

  // Markdown
  if (mime === "text/markdown" || ext === "md") {
    return "markdown";
  }

  // CSV
  if (mime === "text/csv" || ext === "csv") {
    return "csv";
  }

  // Plain text
  if (mime.startsWith("text/") || ext === "txt") {
    return "text";
  }

  // Excel
  if (
    mime.includes("spreadsheet") ||
    mime.includes("excel") ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    ["xlsx", "xls"].includes(ext)
  ) {
    return "excel";
  }

  // PowerPoint
  if (
    mime.includes("presentation") ||
    mime.includes("powerpoint") ||
    mime === "application/vnd.ms-powerpoint" ||
    mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    ["pptx", "ppt"].includes(ext)
  ) {
    return "presentation";
  }

  return "unsupported";
}

/**
 * Получить иконку для типа файла
 */
export function getFileIconComponent(fileType: FileType) {
  switch (fileType) {
    case "image":
      return FileImage;
    case "pdf":
      return FileText;
    case "text":
    case "markdown":
      return FileText;
    case "csv":
    case "excel":
      return FileSpreadsheet;
    case "presentation":
      return Presentation;
    default:
      return File;
  }
}

/**
 * Получить цвет иконки для типа файла
 */
export function getFileIconColor(fileType: FileType): string {
  switch (fileType) {
    case "image":
      return "text-blue-500";
    case "pdf":
      return "text-red-500";
    case "text":
    case "markdown":
      return "text-gray-500";
    case "csv":
    case "excel":
      return "text-green-500";
    case "presentation":
      return "text-orange-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * Форматировать размер файла
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "";

  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/**
 * Получить расширение файла
 */
export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 * Проверить, поддерживается ли файл для превью
 */
export function isPreviewSupported(file: Pick<ViewerFile, "contentType" | "name">): boolean {
  const fileType = getFileType(file);
  return fileType !== "unsupported";
}
