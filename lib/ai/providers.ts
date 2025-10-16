import { createAnthropic } from "@ai-sdk/anthropic";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
        "claude-sonnet-4": anthropic("claude-sonnet-4-5-20250929"),
        "claude-haiku-3.5": anthropic("claude-3-5-haiku-20241022"),
        "title-model": anthropic("claude-sonnet-4-5-20250929"),
        "artifact-model": anthropic("claude-sonnet-4-5-20250929"),
      },
    });
