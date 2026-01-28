"use client";

import type { Agent } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { memo, useCallback, useEffect, useRef, useState } from "react";

type MentionAutocompleteProps = {
  agents: Agent[];
  input: string;
  onSelect: (agent: Agent) => void;
  visible: boolean;
};

function PureMentionAutocomplete({
  agents,
  input,
  onSelect,
  visible,
}: MentionAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Extract the @query from input
  const mentionQuery = extractMentionQuery(input);
  const isOpen = visible && mentionQuery !== null;

  // Filter agents by query
  const filtered = agents.filter((a) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return (
      a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q)
    );
  });

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [mentionQuery]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const items = listRef.current.children;
      if (items[selectedIndex]) {
        (items[selectedIndex] as HTMLElement).scrollIntoView({
          block: "nearest",
        });
      }
    }
  }, [selectedIndex, isOpen]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(filtered[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        // The parent will close by setting visible=false
      }
    },
    [isOpen, filtered, selectedIndex, onSelect]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 z-50 mb-2 w-64 overflow-hidden rounded-lg border border-border bg-background shadow-lg"
      role="listbox"
    >
      <div ref={listRef} className="max-h-48 overflow-y-auto py-1">
        {filtered.map((agent, index) => (
          <button
            key={agent.id}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            onClick={() => onSelect(agent)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="text-base">{agent.icon}</span>
            <span className="truncate font-medium">{agent.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const MentionAutocomplete = memo(PureMentionAutocomplete);

/**
 * Extract the @-mention query from the current input.
 * Returns the text after `@` if the cursor is in a mention context, null otherwise.
 *
 * Examples:
 * - "@" → ""
 * - "@Мар" → "Мар"
 * - "hello @" → ""
 * - "hello" → null
 */
export function extractMentionQuery(input: string): string | null {
  // Find the last @ that starts a mention
  const lastAtIndex = input.lastIndexOf("@");
  if (lastAtIndex === -1) return null;

  // The @ must be at the start or after a space
  if (lastAtIndex > 0 && input[lastAtIndex - 1] !== " ") return null;

  const afterAt = input.slice(lastAtIndex + 1);

  // If there's a space after the @, the mention is complete (not in progress)
  if (afterAt.includes(" ")) return null;

  return afterAt;
}
