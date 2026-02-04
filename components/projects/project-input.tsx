"use client";

import { CompactInput } from "@/components/input";

/**
 * ProjectInput — поле ввода на странице проекта
 *
 * Использует CompactInput с provider="anthropic"
 * При отправке редиректит в чат проекта
 */

interface ProjectInputProps {
  projectId: string;
  projectName: string;
}

export function ProjectInput({ projectId, projectName }: ProjectInputProps) {
  return (
    <CompactInput
      provider="anthropic"
      redirectPath={`/projects/${projectId}/chat`}
      placeholder={`Спросите по проекту "${projectName}"...`}
    />
  );
}
