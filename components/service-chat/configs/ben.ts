/**
 * Ben Configuration
 *
 * Help assistant for Simply platform.
 * ТЗ-09: ServiceChat унификация
 */

import type { ServiceChatConfig } from "../types";

export const BEN_CONFIG: ServiceChatConfig = {
  id: "ben",
  title: "Бен",
  subtitle: "Помощь по платформе Simply",
  icon: "❓",

  // Shell
  shell: "floating",
  position: "bottom-right",
  size: { width: 380, height: 500 },

  // AI
  model: "claude-haiku",
  apiEndpoint: "/api/assistant/ben", // Use existing API for now

  // UX
  greeting: "Привет! Я Бен. Чем могу помочь?",
  persistMessages: false, // FAQ doesn't need persistence
  quickActions: [
    {
      icon: "🚀",
      label: "С чего начать?",
      prompt: "С чего начать работу в Simply?",
    },
    {
      icon: "📊",
      label: "Что такое проект?",
      prompt: "Объясни что такое проект в Simply",
    },
    {
      icon: "🎤",
      label: "Голосовой ввод",
      prompt: "Как использовать голосовой ввод?",
    },
    {
      icon: "📝",
      label: "Документы",
      prompt: "Какие документы можно создавать?",
    },
  ],
};
