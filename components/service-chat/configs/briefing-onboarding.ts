/**
 * Briefing Onboarding Configuration
 *
 * AI-assisted briefing profile setup.
 * ТЗ-A2: Briefing Onboarding
 *
 * Note: This config is for reference/typing only.
 * The actual chat is built as a standalone split-layout page
 * (like project-creation), not via ServiceChatCore.
 */

import type { ServiceChatConfig } from "../types";

export const BRIEFING_ONBOARDING_CONFIG: Omit<ServiceChatConfig, "id" | "shell"> & { id: string } = {
  id: "briefing-onboarding",
  title: "Настройка брифинга",
  subtitle: "Расскажите о ваших интересах",
  icon: "☀️",

  // AI
  model: "claude-sonnet",
  apiEndpoint: "/api/service-chat",

  // UX
  greeting:
    "Привет! Давайте настроим ваш утренний брифинг. Чем вы занимаетесь и что важно знать каждое утро?",
  persistMessages: false,
};
