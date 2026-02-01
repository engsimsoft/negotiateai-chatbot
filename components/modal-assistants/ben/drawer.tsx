"use client";

/**
 * Ben Drawer
 *
 * Help assistant drawer with onboarding support.
 */

import { AssistantDrawer } from "../assistant-drawer";
import { AssistantChat } from "../assistant-chat";
import { getBenGreeting } from "@/lib/prompts/ben/config";

interface BenDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isFirstTime?: boolean;
}

export function BenDrawer({
  open,
  onOpenChange,
  isFirstTime = false,
}: BenDrawerProps) {
  const greeting = getBenGreeting(isFirstTime);

  return (
    <AssistantDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Бен"
      description="Помощь по платформе Simply"
    >
      <AssistantChat
        assistantId="ben"
        initialMessage={greeting}
        isFirstTime={isFirstTime}
      />
    </AssistantDrawer>
  );
}
