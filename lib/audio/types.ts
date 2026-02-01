/**
 * Voice recording states
 */
export type VoiceState = "idle" | "recording" | "processing" | "error";

/**
 * Deepgram WebSocket message types
 */
export interface DeepgramMessage {
  type: "Results" | "Metadata" | "UtteranceEnd" | "SpeechStarted" | "Error";
  /** Channel index */
  channel_index?: [number, number];
  /** Audio duration */
  duration?: number;
  /** Start time */
  start?: number;
  /** Whether this is a final result (not interim) */
  is_final?: boolean;
  /** Whether the speech utterance has ended */
  speech_final?: boolean;
  /** Channel data with alternatives */
  channel?: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words?: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
  /** Error code (Error message) */
  err_code?: string;
  /** Error message (Error message) */
  err_msg?: string;
}

/**
 * Voice recorder options
 */
export interface VoiceRecorderOptions {
  /** Callback when transcript is received */
  onTranscript?: (text: string) => void;
  /** Callback when interim transcript is received (while speaking) */
  onInterimTranscript?: (text: string) => void;
  /** Callback when error occurs */
  onError?: (error: VoiceError) => void;
  /** Callback when recording state changes */
  onStateChange?: (state: VoiceState) => void;
}

/**
 * Voice recorder return type
 */
export interface VoiceRecorderReturn {
  /** Current recording state */
  state: VoiceState;
  /** Whether currently recording */
  isRecording: boolean;
  /** Whether processing (after recording stopped, waiting for final transcript) */
  isProcessing: boolean;
  /** Current transcript text */
  transcript: string;
  /** Current interim transcript (while speaking) */
  interimTranscript: string;
  /** Current error if any */
  error: VoiceError | null;
  /** Start recording */
  startRecording: () => Promise<void>;
  /** Stop recording */
  stopRecording: () => void;
  /** Check if voice input is available */
  isAvailable: boolean;
}

/**
 * Voice error types
 */
export type VoiceErrorType =
  | "permission_denied"
  | "no_microphone"
  | "network_error"
  | "api_error"
  | "browser_unsupported"
  | "unknown";

/**
 * Voice error with type and message
 */
export interface VoiceError {
  type: VoiceErrorType;
  message: string;
  originalError?: Error;
}

/**
 * Audio chunk for streaming
 */
export interface AudioChunk {
  /** PCM audio data as base64 */
  audio_data: string;
}
