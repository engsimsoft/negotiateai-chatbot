"use client";

import { type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import { useInputContext } from "./input-context";

/**
 * InputBase — базовый контейнер инпута
 *
 * Дизайн в стиле Google Gemini / Claude Desktop:
 * - Большие скругления (24px)
 * - Мягкая тень
 * - Разделение на зоны (textarea + toolbar)
 * - Плавные анимации
 */

interface InputBaseProps {
  children: ReactNode;
  className?: string;
}

export function InputBase({ children, className }: InputBaseProps) {
  const { isFocused, setIsFocused, handleSubmit } = useInputContext();

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        // Base styles
        "relative flex flex-col overflow-hidden",
        // Shape
        "rounded-3xl",
        // Background
        "bg-muted/50 dark:bg-muted/30",
        // Border
        "border border-border/50",
        // Shadow
        "shadow-sm",
        // Transitions
        "transition-all duration-200 ease-out",
        // Focus state
        isFocused && [
          "border-border",
          "shadow-md",
          "bg-background dark:bg-background",
        ],
        // Hover state (when not focused)
        !isFocused && "hover:border-border/80 hover:bg-muted/30",
        className
      )}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {children}
    </div>
  );
}

/**
 * InputContent — зона для textarea
 */
interface InputContentProps {
  children: ReactNode;
  className?: string;
}

export function InputContent({ children, className }: InputContentProps) {
  return (
    <div className={cn("px-5 pt-4 pb-2", className)}>
      {children}
    </div>
  );
}

/**
 * InputToolbar — нижняя панель с кнопками
 */
interface InputToolbarProps {
  children: ReactNode;
  className?: string;
}

export function InputToolbar({ children, className }: InputToolbarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2",
        "px-3 py-2",
        "border-t border-border/30",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * InputToolbarLeft — левая часть toolbar
 */
export function InputToolbarLeft({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {children}
    </div>
  );
}

/**
 * InputToolbarRight — правая часть toolbar
 */
export function InputToolbarRight({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {children}
    </div>
  );
}
