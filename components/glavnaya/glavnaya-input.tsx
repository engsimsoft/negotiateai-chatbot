"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, type KeyboardEvent } from "react";
import { ArrowRight, Mic, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GlavnayaInput() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Navigate to chat with message as query param
    router.push(`/chat?query=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-background px-5 py-4 shadow-sm transition-colors",
        isFocused ? "border-primary" : "border-border"
      )}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Спросите что угодно..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
      />
      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground hover:text-foreground"
          onClick={() => {
            // Voice input - TODO: integrate with voice recorder
          }}
        >
          <Mic className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground hover:text-foreground"
          onClick={() => {
            // Attach file - TODO: implement file upload
          }}
        >
          <Paperclip className="size-5" />
        </Button>
        <Button
          size="icon"
          className={cn(
            "size-9 transition-colors",
            value.trim()
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground"
          )}
          disabled={!value.trim()}
          onClick={handleSubmit}
        >
          <ArrowRight className="size-5" />
        </Button>
      </div>
    </div>
  );
}
