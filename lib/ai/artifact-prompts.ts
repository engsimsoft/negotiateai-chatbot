import type { ArtifactKind } from "@/components/artifact";

/**
 * System prompt fragment used by artifact handlers (text, markdown,
 * presentation-reveal) when the user requests a document update. The current
 * document contents are injected so the model can rewrite in-place rather
 * than re-generating from scratch.
 *
 * NOTE: this is the sole surviving export from the original `lib/ai/prompts.ts`
 * inherited from the Vercel AI Chatbot template. The rest was replaced by the
 * modular prompt system under `lib/prompts/` in v3.0.0 and removed as dead
 * code on 2026-04-17.
 */
export const updateDocumentPrompt = (
  currentContent: string | null,
  _type: ArtifactKind,
) => {
  return `Improve the following contents of the document based on the given prompt.

${currentContent}`;
};
