"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import { DownloadIcon, ShareIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface PptxMetadata {
  pptxUrl: string;
  previewUrls: string[];
  slideCount: number;
  themeId: string;
}

export const presentationPptxArtifact = new Artifact<
  "presentation-pptx",
  PptxMetadata
>({
  kind: "presentation-pptx",
  description: "PowerPoint presentations with download",
  initialize: () => ({
    pptxUrl: "",
    previewUrls: [],
    slideCount: 0,
    themeId: "corporate",
  }),
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === "data-pptxComplete") {
      const data = streamPart.data as PptxMetadata;
      setMetadata({
        pptxUrl: data.pptxUrl,
        previewUrls: data.previewUrls,
        slideCount: data.slideCount,
        themeId: data.themeId,
      });
      setArtifact((draft) => ({
        ...draft,
        content: JSON.stringify(data),
        isVisible: true,
        status: "idle",
      }));
    } else if (streamPart.type === "data-pptxStatus") {
      setArtifact((draft) => ({
        ...draft,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content, status, isLoading, metadata }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const previewUrls = metadata?.previewUrls ?? [];

    const handlePrevSlide = useCallback(() => {
      if (!previewUrls.length) return;
      setCurrentSlide((prev) =>
        prev > 0 ? prev - 1 : previewUrls.length - 1
      );
    }, [previewUrls.length]);

    const handleNextSlide = useCallback(() => {
      if (!previewUrls.length) return;
      setCurrentSlide((prev) =>
        prev < previewUrls.length - 1 ? prev + 1 : 0
      );
    }, [previewUrls.length]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") handlePrevSlide();
        else if (e.key === "ArrowRight") handleNextSlide();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handlePrevSlide, handleNextSlide]);

    if (isLoading || status === "streaming") {
      return <DocumentSkeleton artifactKind="presentation-pptx" />;
    }

    const pptxUrl = metadata?.pptxUrl ?? "";
    const slideCount = metadata?.slideCount ?? 0;

    if (!pptxUrl) {
      return (
        <div className="flex items-center justify-center h-full w-full">
          <p className="text-muted-foreground">Нет данных презентации</p>
        </div>
      );
    }

    if (previewUrls.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div className="w-24 h-24 rounded-lg bg-orange-100 flex items-center justify-center">
            <DownloadIcon size={48} />
          </div>
          <h3 className="text-lg font-medium">Презентация готова!</h3>
          <p className="text-sm text-muted-foreground">
            {slideCount} слайдов
          </p>
          <a
            href={pptxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            <DownloadIcon size={16} />
            Скачать PPTX
          </a>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 relative bg-muted rounded-lg overflow-hidden min-h-[300px]">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {previewUrls[currentSlide] && (
              <img
                src={previewUrls[currentSlide]}
                alt={`Слайд ${currentSlide + 1}`}
                className="max-w-full max-h-full object-contain shadow-lg rounded"
              />
            )}
          </div>
          {previewUrls.length > 1 && (
            <>
              <button
                onClick={handlePrevSlide}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 dark:bg-background/50 hover:bg-background shadow-md"
              >
                ←
              </button>
              <button
                onClick={handleNextSlide}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 dark:bg-background/50 hover:bg-background shadow-md"
              >
                →
              </button>
            </>
          )}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm">
            {currentSlide + 1} / {previewUrls.length}
          </div>
        </div>
        {previewUrls.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
            {previewUrls.map((url, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={cn(
                  "flex-shrink-0 w-16 h-12 rounded border-2 overflow-hidden",
                  currentSlide === index
                    ? "border-primary"
                    : "border-transparent hover:border-muted-foreground/30"
                )}
              >
                <img src={url} alt={`${index + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
  actions: [
    {
      icon: <DownloadIcon size={18} />,
      description: "Download PPTX",
      onClick: ({ content }) => {
        try {
          const data: PptxMetadata = JSON.parse(content);
          if (data.pptxUrl) window.open(data.pptxUrl, "_blank");
        } catch {
          toast.error("Не удалось скачать");
        }
      },
    },
    {
      icon: <ShareIcon size={18} />,
      description: "Share",
      onClick: ({ openShareModal }) => openShareModal(),
    },
  ],
  toolbar: [],
});
