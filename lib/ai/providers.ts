import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

/**
 * AI Provider Configuration
 *
 * В проекте используются только 2 модели Google:
 * 1. Gemini 3 Pro (gemini-3-pro-preview) - профессиональные задачи, dynamic thinking
 * 2. Gemini 2.5 Flash (gemini-2.5-flash) - простые задачи, быстрый ответ
 *
 * Legacy ID (claude-*) сохранены для обратной совместимости со старыми чатами в БД.
 */

// Initialize Google provider
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          // Primary model IDs (используются во всём проекте)
          "gemini-3-pro": chatModel,       // Professional agents
          "gemini-2.5-flash": chatModel,   // Casual agents

          // Legacy model IDs (backward compatibility для старых чатов в БД)
          "claude-sonnet-4": chatModel,
          "claude-haiku-3.5": chatModel,

          // Internal use only (не показываются в UI)
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        // Primary model IDs (используются во всём проекте)
        "gemini-3-pro": google("gemini-3-pro-preview"),       // Professional agents (Marketer, Copywriter, Translator, Mentor)
        "gemini-2.5-flash": google("gemini-2.5-flash"),       // Casual agents (Cook, Astrologer, Universal, Odessit)

        // Legacy model IDs (backward compatibility для старых чатов в БД)
        "claude-sonnet-4": google("gemini-2.5-pro"),          // Старые чаты, артефакты
        "claude-haiku-3.5": google("gemini-2.5-flash"),       // Старые чаты

        // Internal use only (не показываются в UI, используются внутри)
        "title-model": google("gemini-2.5-flash"),            // Генерация заголовков чатов
        "artifact-model": google("gemini-2.5-pro"),           // Генерация suggestions для артефактов
      },
    });
