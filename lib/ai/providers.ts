import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

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
          "claude-sonnet-4": chatModel,
          "claude-haiku-3.5": chatModel, // Use same mock for testing
          "gemini-3-pro": chatModel, // Agent model for professional tasks
          "gemini-2.5-flash": chatModel, // Agent model for casual tasks
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "claude-sonnet-4": google("gemini-2.5-pro"),
        "claude-haiku-3.5": google("gemini-2.5-flash"),
        "gemini-3-pro": google("gemini-3-pro-preview"), // Professional agents (Marketer, Copywriter, Translator, Mentor)
        "gemini-2.5-flash": google("gemini-2.5-flash"), // Casual agents (Cook, Astrologer, Universal, Odessit)
        "title-model": google("gemini-2.5-flash"),
        "artifact-model": google("gemini-2.5-pro"),
      },
    });
