// ТЗ-MR Этап 3: Deepgram batch transcription — raw fetch to REST API (no SDK)

import "server-only";

const DEEPGRAM_API_URL = "https://api.deepgram.com/v1/listen";

interface DeepgramWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

interface DeepgramUtterance {
  start: number;
  end: number;
  transcript: string;
  speaker: number;
  words: DeepgramWord[];
}

interface DeepgramChannel {
  alternatives: Array<{
    transcript: string;
    words: DeepgramWord[];
    paragraphs?: {
      paragraphs: Array<{
        sentences: Array<{
          text: string;
          start: number;
          end: number;
        }>;
        speaker: number;
        start: number;
        end: number;
      }>;
    };
  }>;
}

interface DeepgramResponse {
  results: {
    channels: DeepgramChannel[];
    utterances?: DeepgramUtterance[];
  };
  metadata: {
    duration: number;
    channels: number;
    models: string[];
  };
}

export interface TranscriptionResult {
  /** Formatted transcript: [HH:MM:SS] Speaker N: text */
  transcript: string;
  /** Number of unique speakers detected */
  speakerCount: number;
  /** Audio duration in seconds from Deepgram metadata */
  durationSeconds: number;
  /** Raw Deepgram response metadata */
  metadata: {
    model: string;
    durationMs: number;
  };
}

/** Format seconds to HH:MM:SS */
function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Transcribe audio using Deepgram Nova-3 batch API.
 *
 * @param audioUrl - Public URL of the audio file (Vercel Blob)
 * @returns Formatted transcript with speaker diarization
 */
export async function transcribeAudio(
  audioUrl: string,
): Promise<TranscriptionResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    model: "nova-3",
    language: "ru",
    smart_format: "true",
    diarize: "true",
    utterances: "true",
    paragraphs: "true",
  });

  const startTime = Date.now();

  const response = await fetch(`${DEEPGRAM_API_URL}?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Deepgram API error ${response.status}: ${errorText}`,
    );
  }

  const data: DeepgramResponse = await response.json();
  const durationMs = Date.now() - startTime;

  // Format transcript from utterances (preferred) or fallback to channel transcript
  const speakers = new Set<number>();
  let formattedLines: string[];

  if (data.results.utterances && data.results.utterances.length > 0) {
    formattedLines = data.results.utterances.map((utt) => {
      speakers.add(utt.speaker);
      const ts = formatTimestamp(utt.start);
      return `[${ts}] Спикер ${utt.speaker + 1}: ${utt.transcript}`;
    });
  } else {
    // Fallback: use paragraphs from channel
    const channel = data.results.channels[0];
    const alt = channel?.alternatives[0];

    if (alt?.paragraphs?.paragraphs) {
      formattedLines = alt.paragraphs.paragraphs.map((para) => {
        speakers.add(para.speaker);
        const ts = formatTimestamp(para.start);
        const text = para.sentences.map((s) => s.text).join(" ");
        return `[${ts}] Спикер ${para.speaker + 1}: ${text}`;
      });
    } else {
      // Last fallback: plain transcript
      formattedLines = [alt?.transcript ?? ""];
    }
  }

  return {
    transcript: formattedLines.join("\n"),
    speakerCount: Math.max(speakers.size, 1),
    durationSeconds: Math.round(data.metadata.duration),
    metadata: {
      model: data.metadata.models?.[0] ?? "nova-3",
      durationMs,
    },
  };
}
