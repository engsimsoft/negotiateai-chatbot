"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { generateUUID } from "@/lib/utils";

interface StartChatButtonProps {
  agentId: string;
}

export function StartChatButton({ agentId }: StartChatButtonProps) {
  const router = useRouter();

  const handleStartChat = () => {
    const newChatId = generateUUID();
    router.push(`/chat/${newChatId}?agentId=${agentId}`);
  };

  return (
    <Button onClick={handleStartChat}>
      Начать чат
    </Button>
  );
}
