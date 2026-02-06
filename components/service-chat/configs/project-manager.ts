/**
 * Project Manager Configuration
 *
 * AI assistant for project management tasks.
 * ТЗ-09: ServiceChat унификация
 */

import type { ServiceChatConfig } from "../types";

export const PROJECT_MANAGER_CONFIG: ServiceChatConfig = {
  id: "project-manager",
  title: "Менеджер проекта",
  subtitle: "Организация и управление",
  icon: "👤",

  // Shell
  shell: "drawer",
  // drawer is always right, width ~420px

  // AI
  // ⚠️ ВРЕМЕННО (v3.7.1): Gemini вместо Claude — см. ADR 011
  model: "gemini-flash",
  apiEndpoint: "/api/service-chat", // Will use unified API

  // UX
  greeting:
    "Привет! Я менеджер этого проекта. Могу помочь с организацией файлов, обновлением инструкции, декомпозицией задач. Чем помочь?",
  persistMessages: true, // Long conversations, persist in session
  quickActions: [
    {
      icon: "📁",
      label: "Разобрать файлы",
      prompt: "Помоги разобрать файлы проекта по папкам",
    },
    {
      icon: "📊",
      label: "Подвести итог",
      prompt: "Подведи итог по текущему состоянию проекта",
    },
    {
      icon: "📝",
      label: "Обновить инструкцию",
      prompt: "Хочу обновить инструкцию проекта",
    },
    {
      icon: "📋",
      label: "Разбить на задачи",
      prompt: "Разбей цель проекта на конкретные задачи",
    },
  ],
};
