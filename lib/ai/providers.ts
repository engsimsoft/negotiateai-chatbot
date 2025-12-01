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
          "title-model": titleModel,
          "artifact-model": artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        "claude-sonnet-4": google("gemini-3-pro-preview"),
        "claude-haiku-3.5": google("gemini-2.5-flash"),
        "title-model": google("gemini-2.5-flash"),
        "artifact-model": google("gemini-3-pro-preview"),
      },
    });
