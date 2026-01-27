import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

/**
 * AI Provider Configuration
 *
 * В проекте используются только 2 модели Google:
 * 1. Gemini 3 Pro (gemini-3-pro-preview) - профессиональные задачи, dynamic thinking
 * 2. Gemini 2.5 Flash (gemini-2.5-flash) - простые задачи, быстрый ответ
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
          "auto": chatModel,               // Default fallback (не используется напрямую, только UI)
          "gemini-3-pro": chatModel,       // Professional agents
          "gemini-2.5-flash": chatModel,   // Casual agents

          // Internal use only (не показываются в UI)
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        // Primary model IDs (используются во всём проекте)
        "auto": google("gemini-2.5-flash"),                   // Default fallback (не используется напрямую, только UI)
        "gemini-3-pro": google("gemini-3-pro-preview"),       // Professional agents (Marketer, Copywriter, Translator, Mentor)
        "gemini-2.5-flash": google("gemini-2.5-flash"),       // Casual agents (Cook, Astrologer, Universal, Odessit)

        // Internal use only (не показываются в UI, используются внутри)
        "title-model": google("gemini-2.5-flash"),            // Генерация заголовков чатов
        "artifact-model": google("gemini-2.5-pro"),           // Генерация suggestions для артефактов
      },
    });
