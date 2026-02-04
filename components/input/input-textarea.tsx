"use client";

import { useRef, useEffect, type ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { useInputContext } from "./input-context";

/**
 * InputTextarea — поле ввода текста
 *
 * Автоматически подстраивает высоту под контент
 */

interface InputTextareaProps {
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  autoFocus?: boolean;
}

export function InputTextarea({
  placeholder = "Спросите что угодно...",
  className,
  minHeight = 24,
  maxHeight = 200,
  autoFocus = false,
}: InputTextareaProps) {
  const { value, setValue, disabled } = useInputContext();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = Math.min(Math.max(scrollHeight, minHeight), maxHeight) + "px";
  }, [value, minHeight, maxHeight]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      rows={1}
      className={cn(
        // Reset
        "resize-none border-0 bg-transparent outline-none",
        // Size
        "w-full",
        // Typography
        "text-base leading-relaxed",
        "placeholder:text-muted-foreground/60",
        // Scrollbar hide
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        // Focus
        "focus:outline-none focus:ring-0",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      style={{
        minHeight: minHeight,
        maxHeight: maxHeight,
      }}
    />
  );
}
