"use client";

import { useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface UploadButtonProps {
  collectionId: string | null;
  onUploaded: () => void | Promise<void>;
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;

export function UploadButton({ collectionId, onUploaded }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size === 0) {
          toast.error(`${file.name}: пустой файл`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          toast.error(`${file.name}: больше 100 МБ`);
          continue;
        }
        const form = new FormData();
        form.append("file", file);
        form.append("filename", file.name);
        if (collectionId) {
          form.append("collectionIds", collectionId);
        }
        try {
          const res = await fetch("/api/library/documents", {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Ошибка загрузки");
          }
          toast.success(`${file.name} загружен`);
        } catch (err) {
          toast.error(
            `${file.name}: ${err instanceof Error ? err.message : "ошибка"}`,
          );
        }
      }
      await onUploaded();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.docx,.xlsx,.xls,.xlsm,.csv,.txt,.md,.jpg,.jpeg,.png,.pptx"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
        ) : (
          <Plus className="mr-1.5 size-3.5" />
        )}
        Загрузить
      </Button>
    </>
  );
}
