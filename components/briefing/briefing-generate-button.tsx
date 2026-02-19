"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BriefingGenerateButtonProps {
  label?: string;
}

export function BriefingGenerateButton({
  label = "Сгенерировать брифинг",
}: BriefingGenerateButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleGenerate() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/briefing/generate", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка генерации");
      }
      toast.success("Брифинг готов!");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Не удалось сгенерировать брифинг",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Button onClick={handleGenerate} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 size-4" />
      )}
      {isLoading ? "Генерируем..." : label}
    </Button>
  );
}
