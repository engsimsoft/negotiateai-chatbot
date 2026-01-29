"use client";

import Image from "next/image";
import { useState } from "react";
import type { Attachment } from "@/lib/types";
import { ImageLightbox } from "./image-lightbox";
import { Loader } from "./elements/loader";
import { CrossSmallIcon } from "./icons";
import { Button } from "./ui/button";

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const isImage = contentType?.startsWith("image");

  // Determine file icon based on content type or filename
  const getFileIcon = () => {
    // Check by filename extension first (for Excel files that are converted to text)
    const ext = name?.toLowerCase().match(/\.(xlsx|xls)$/)?.[1];
    if (ext === "xlsx" || ext === "xls") {
      return "📊"; // Excel icon
    }

    // Check by content type
    if (contentType?.includes("spreadsheetml") || contentType?.includes("ms-excel")) {
      return "📊"; // Excel icon
    } else if (contentType?.includes("pdf")) {
      return "📄"; // PDF icon
    } else if (contentType?.includes("wordprocessingml")) {
      return "📝"; // DOCX icon
    } else if (contentType?.includes("text/plain")) {
      return "📃"; // TXT icon
    } else if (contentType?.includes("text/markdown")) {
      return "📋"; // MD icon
    }
    return "📎"; // Generic file icon
  };

  const handleClick = () => {
    if (isImage && url && !isUploading) {
      // Open lightbox for images in both input area and messages
      setLightboxOpen(true);
    }
  };

  return (
    <>
      <div
        className={`group relative size-16 overflow-hidden rounded-lg border bg-muted ${
          isImage && !isUploading ? "cursor-pointer transition-transform hover:scale-105" : ""
        }`}
        data-testid="input-attachment-preview"
        onClick={handleClick}
        role={isImage ? "button" : undefined}
        tabIndex={isImage ? 0 : undefined}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && isImage && !isUploading) {
            e.preventDefault();
            setLightboxOpen(true);
          }
        }}
      >
        {isImage ? (
          <Image
            alt={name ?? "An image attachment"}
            className="size-full object-cover"
            height={64}
            src={url}
            width={64}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center text-muted-foreground text-xs">
            <div className="text-2xl">{getFileIcon()}</div>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader size={16} />
          </div>
        )}

        {onRemove && !isUploading && (
          <Button
            className="absolute top-0.5 right-0.5 z-20 size-4 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onRemove();
            }}
            size="sm"
            variant="destructive"
          >
            <CrossSmallIcon size={8} />
          </Button>
        )}

        <div className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-black/80 to-transparent px-1 py-0.5 text-[10px] text-white">
          {name}
        </div>

        {/* Hover hint for clickable images */}
        {isImage && !isUploading && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-white text-xs">Click to view</span>
          </div>
        )}
      </div>

      {/* Lightbox for full-size image viewing */}
      {isImage && url && (
        <ImageLightbox
          alt={name ?? "Image"}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          src={url}
        />
      )}
    </>
  );
};
