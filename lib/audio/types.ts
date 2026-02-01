/**
 * Voice recording states
 */
export type VoiceState = "idle" | "recording" | "processing" | "error";

/**
 * AssemblyAI transcript response
 */
export interface TranscriptResult {
  /** Raw transcript text */
  transcript: string;
  /** Formatted transcript with punctuation */
  utterance?: string;
  /** Whether this is the end of a turn (speech segment) */
  end_of_turn: boolean;
  /** Whether the turn is formatted */
  turn_is_formatted: boolean;
}

/**
 * AssemblyAI WebSocket message types
 */
export interface AssemblyAIMessage {
  message_type: "SessionBegins" | "PartialTranscript" | "FinalTranscript" | "SessionTerminated" | "Error";
  session_id?: string;
  expires_at?: string;
  transcript?: string;
  utterance?: string;
  end_of_turn?: boolean;
  turn_is_formatted?: boolean;
  error?: string;
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
