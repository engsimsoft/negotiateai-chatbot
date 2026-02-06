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
  model: "gemini-flash",
  apiEndpoint: "/api/service-chat", // Will use unified API

  // UX
  greeting:
    "Привет! Расскажите о проекте, который хотите создать. Какая цель? Для кого? Я помогу сформулировать паспорт проекта.",
  persistMessages: false, // Short interview, no need to persist
  quickActions: [
    {
      icon: "📝",
      label: "Контент",
      prompt: "Хочу создать проект для написания контента",
    },
    {
      icon: "📊",
      label: "Аналитика",
      prompt: "Нужен проект для анализа данных",
    },
    {
      icon: "🎓",
      label: "Обучение",
      prompt: "Планирую создать обучающий курс",
    },
    {
      icon: "💼",
      label: "Бизнес",
      prompt: "Хочу запустить бизнес-проект",
    },
  ],
};
