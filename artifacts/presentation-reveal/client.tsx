"use client";

import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { DocumentSkeleton } from "@/components/document-skeleton";
import {
  CopyIcon,
  FullscreenIcon,
  RedoIcon,
  ShareIcon,
  UndoIcon,
} from "@/components/icons";
import type { Slide } from "@/lib/presentations/themes";

interface PresentationMetadata {
  html: string;
  slides: Slide[];
  themeId: string;
  isComplete: boolean;
}

export const presentationRevealArtifact = new Artifact<
  "presentation-reveal",
  PresentationMetadata
>({
  kind: "presentation-reveal",
  description: "Interactive presentations with Reveal.js",
  initialize: () => ({
    html: "",
    slides: [],
    themeId: "corporate",
    isComplete: false,
  }),
  onStreamPart: ({ streamPart, setArtifact, setMetadata }) => {
    if (streamPart.type === "data-presentationDelta") {
      const data = streamPart.data as {
        jsonContent?: string;
        themeId?: string;
        html?: string;
        isComplete?: boolean;
      };

      if (data.isComplete && data.html) {
        const html = data.html;
        setMetadata({
          html,
          slides: data.jsonContent ? JSON.parse(data.jsonContent) : [],
          themeId: data.themeId || "corporate",
          isComplete: true,
        });

        setArtifact((draft) => ({
          ...draft,
          content: html,
          isVisible: true,
          status: "idle",
        }));
      } else {
        // During streaming, show loading state
        setArtifact((draft) => ({
          ...draft,
          isVisible: true,
          status: "streaming",
        }));

        if (data.themeId) {
          setMetadata((prev) => ({
            ...prev,
            themeId: data.themeId || "corporate",
          }));
        }
      }
    }
  },
  content: ({ content, status, isLoading }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isIframeLoaded, setIsIframeLoaded] = useState(false);

    // Parse content if it's stored JSON
    let htmlContent = content;
    if (content && content.startsWith("{")) {
      try {
        const parsed = JSON.parse(content);
        htmlContent = parsed.html || "";
      } catch {
        // Use content as-is if not JSON
      }
    }

    useEffect(() => {
      setIsIframeLoaded(false);
    }, [htmlContent]);

    if (isLoading || status === "streaming") {
      return <DocumentSkeleton artifactKind="presentation-reveal" />;
    }

    if (!htmlContent) {
      return (
        <div className="flex items-center justify-center h-full w-full">
          <p className="text-muted-foreground">No presentation content</p>
        </div>
      );
    }

    return (
      <div className="relative w-full h-full min-h-[500px]">
        {!isIframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">
              Loading presentation...
            </p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          srcDoc={htmlContent}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin"
          onLoad={() => setIsIframeLoaded(true)}
          style={{ opacity: isIframeLoaded ? 1 : 0 }}
        />
      </div>
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: "Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <FullscreenIcon size={18} />,
      description: "Fullscreen",
      onClick: () => {
        const iframe = document.querySelector(
          'iframe[srcdoc]'
        ) as HTMLIFrameElement;
        if (iframe) {
          iframe.requestFullscreen?.();
        }
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy HTML",
      onClick: ({ content }) => {
        let html = content;
        if (content.startsWith("{")) {
          try {
            const parsed = JSON.parse(content);
            html = parsed.html || content;
          } catch {
            // Use as-is
          }
        }
        navigator.clipboard.writeText(html);
        toast.success("HTML copied to clipboard!");
      },
    },
    {
      icon: <ShareIcon size={18} />,
      description: "Share presentation",
      onClick: ({ openShareModal }) => {
        openShareModal();
      },
    },
  ],
  toolbar: [],
});
