"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { CrossSmallIcon } from "./icons";

interface ImageLightboxProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            onClick={onClose}
            type="button"
          >
            <CrossSmallIcon size={20} />
          </button>

          {/* Image container */}
          <motion.div
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 max-h-[90vh] max-w-[90vw]"
            exit={{ scale: 0.9, opacity: 0 }}
            initial={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <Image
              alt={alt}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
              height={1080}
              src={src}
              style={{ width: "auto", height: "auto" }}
              width={1920}
            />
          </motion.div>

          {/* Hint text */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
            Press ESC or click outside to close
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
