import { registerOTel } from "@vercel/otel";

export async function register() {
  registerOTel({ serviceName: "ai-chatbot" });

  // ⛔ SSOT: единственное место регистрации dev-overrides reader.
  // Не дублировать `import "@/lib/ai/model-overrides-node"` в backend routes —
  // boot-time register покрывает все routes и Server Actions. См. ADR 048.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/ai/model-overrides-node");
  }
}
