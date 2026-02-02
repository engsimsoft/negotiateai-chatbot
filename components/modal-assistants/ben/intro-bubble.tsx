"use client";

/**
 * Ben Intro Bubble
 *
 * A small speech bubble that appears next to the Ben trigger button
 * for first-time users. Dismisses on click or after timeout.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface BenIntroBubbleProps {
  show: boolean;
  onDismiss: () => void;
}

export function BenIntroBubble({ show, onDismiss }: BenIntroBubbleProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="absolute right-0 top-full z-50 mt-2"
        >
          {/* Speech bubble */}
          <div className="relative rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg">
            {/* Arrow pointing up */}
            <div className="absolute -top-2 right-4 size-0 border-x-8 border-b-8 border-x-transparent border-b-popover" />
            <div className="absolute -top-[9px] right-4 size-0 border-x-8 border-b-8 border-x-transparent border-b-border" />

            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
              aria-label="Закрыть"
            >
              <X className="size-3" />
            </button>

            {/* Message */}
            <p className="max-w-[200px] text-popover-foreground">
              Привет! Я <span className="font-medium">Бен</span> — помогу разобраться.
              Если что — я всегда в углу
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
