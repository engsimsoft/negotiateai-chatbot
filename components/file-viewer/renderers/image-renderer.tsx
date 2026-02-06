"use client";

import { useState } from "react";
import { ImageOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { FileRendererProps } from "../types";

/**
 * Рендерер для изображений
 *
 * Особенности:
 * - object-fit: contain — изображение вписывается полностью
 * - Loading состояние со спиннером
 * - onError → fallback с кнопкой "Скачать"
 * - Плавное появление (fade-in)
 */
export function ImageRenderer({ file, onLoad, onError }: FileRendererProps) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  const handleLoad = () => {
    setStatus("success");
    onLoad?.();
  };

  const handleError = () => {
    setStatus("error");
    onError?.();
  };

  // Error state — show fallback
  if (status === "error") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 p-8">
        <div className="rounded-2xl bg-muted p-6">
          <ImageOff className="size-16 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-medium">{file.name}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Не удалось загрузить изображение
          </p>
        </div>
        <Button size="lg" className="gap-2" asChild>
          <a href={file.url} download={file.name} target="_blank" rel="noopener noreferrer">
            <Download className="size-5" />
            Скачать файл
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/* Loading spinner */}
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-10 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Image */}
      <img
        src={file.url}
        alt={file.name}
        className={`max-h-full max-w-full object-contain transition-opacity duration-300 ${
          status === "loading" ? "opacity-0" : "opacity-100"
        }`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
