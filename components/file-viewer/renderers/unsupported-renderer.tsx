"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileRendererProps } from "../types";
import { getFileType, getFileIconComponent, getFileIconColor, formatFileSize } from "../utils";

/**
 * Рендерер для неподдерживаемых форматов
 *
 * Показывает:
 * - Иконку типа файла
 * - Имя файла
 * - Размер файла
 * - Сообщение "Этот формат нельзя просмотреть"
 * - Кнопку "Скачать файл"
 */
export function UnsupportedRenderer({ file }: FileRendererProps) {
  const fileType = getFileType(file);
  const IconComponent = getFileIconComponent(fileType);
  const iconColor = getFileIconColor(fileType);
  const fileSize = formatFileSize(file.size);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
      {/* Icon */}
      <div className="rounded-2xl bg-muted p-6">
        <IconComponent className={`size-16 ${iconColor}`} />
      </div>

      {/* File info */}
      <div className="text-center">
        <h3 className="text-lg font-medium">{file.name}</h3>
        {fileSize && (
          <p className="mt-1 text-sm text-muted-foreground">{fileSize}</p>
        )}
      </div>

      {/* Message */}
      <p className="text-center text-muted-foreground">
        Этот формат нельзя просмотреть в браузере
      </p>

      {/* Download button */}
      <Button size="lg" className="gap-2" asChild>
        <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
          <Download className="size-5" />
          Скачать файл
        </a>
      </Button>
    </div>
  );
}
