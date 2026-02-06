import type { ProjectFile } from "@/lib/db/schema";

/**
 * Типы файлов для FileViewer
 */
export type FileType =
  | "image"
  | "pdf"
  | "text"
  | "markdown"
  | "csv"
  | "excel"
  | "presentation"
  | "unsupported";

/**
 * Состояние загрузки контента
 */
export type FileViewerStatus = "loading" | "success" | "error";

/**
 * Файл для FileViewer (расширенный ProjectFile)
 */
export interface ViewerFile {
  id: string;
  name: string;
  url: string;
  contentType: string | null;
  size?: number | null;
  metadata?: {
    extractedContent?: string;
    [key: string]: unknown;
  } | null;
}

/**
 * Props главного компонента FileViewer
 */
export interface FileViewerProps {
  /** Файл для просмотра */
  file: ViewerFile;
  /** Массив файлов для навигации (опционально) */
  files?: ViewerFile[];
  /** Индекс текущего файла в массиве */
  currentIndex?: number;
  /** Открыта ли модалка */
  open: boolean;
  /** Callback закрытия */
  onClose: () => void;
  /** Callback навигации между файлами */
  onNavigate?: (index: number) => void;
}

/**
 * Props для header компонента
 */
export interface FileViewerHeaderProps {
  /** Имя файла */
  fileName: string;
  /** URL для скачивания */
  fileUrl: string;
  /** Индекс текущего файла (для индикатора позиции) */
  currentIndex?: number;
  /** Общее количество файлов */
  totalFiles?: number;
  /** Callback закрытия */
  onClose: () => void;
}

/**
 * Props для рендереров контента
 */
export interface FileRendererProps {
  file: ViewerFile;
  onError?: () => void;
  onLoad?: () => void;
}

/**
 * Конвертация ProjectFile в ViewerFile
 */
export function toViewerFile(file: ProjectFile): ViewerFile {
  return {
    id: file.id,
    name: file.name,
    url: file.url,
    contentType: file.mimeType,
    size: file.size,
    metadata: file.metadata as ViewerFile["metadata"],
  };
}
