import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "ai-chatbot" });

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/ai/model-overrides-node");
  }
}
