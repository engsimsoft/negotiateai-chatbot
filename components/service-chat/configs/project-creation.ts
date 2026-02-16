/**
 * Project Creation Configuration
 *
 * AI-assisted project creation dialog.
 * ТЗ-09: ServiceChat унификация
 */

import type { ServiceChatConfig } from "../types";

export const PROJECT_CREATION_CONFIG: ServiceChatConfig = {
  id: "project-creation",
  title: "Создание проекта",
  subtitle: "Расскажите о вашей задаче",
  icon: "➕",

  // Shell
  shell: "floating",
  position: "center",
  size: { width: 440, height: 540 },

  // AI
  model: "claude-haiku",
  apiEndpoint: "/api/service-chat", // Will use unified API

  // UX
  greeting:
    "Привет! Расскажите, какой проект хотите создать?",
  persistMessages: false, // Short interview, no need to persist
};
