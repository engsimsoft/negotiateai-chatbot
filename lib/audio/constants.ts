/**
 * Audio constants for Deepgram streaming
 */

/** Sample rate required by Deepgram (16kHz) */
export const SAMPLE_RATE = 16000;

/** Buffer size for audio processing (256 samples = 16ms at 16kHz) */
export const BUFFER_SIZE = 256;

/** Maximum recording duration in milliseconds (3 minutes) */
export const MAX_RECORDING_DURATION = 3 * 60 * 1000;

/** Deepgram WebSocket endpoint */
export const DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen";

/** Token endpoint */
export const TOKEN_ENDPOINT = "/api/deepgram/token";

/** Deepgram connection parameters for Russian language */
export const DEEPGRAM_PARAMS: Record<string, string> = {
  model: "nova-3",
  language: "ru",
  smart_format: "true",
  punctuate: "true",
  interim_results: "true",
  // Без автостопа — запись до ручного нажатия кнопки
  // endpointing и utterance_end_ms убраны намеренно
  encoding: "linear16",
  sample_rate: "16000",
  channels: "1",
};

/** Error messages in Russian */
export const VOICE_ERROR_MESSAGES: Record<string, string> = {
  permission_denied: "Разрешите доступ к микрофону в настройках браузера",
  no_microphone: "Микрофон не найден. Подключите микрофон и попробуйте снова",
  network_error: "Ошибка соединения. Проверьте интернет и попробуйте снова",
  api_error: "Ошибка сервиса распознавания. Попробуйте позже",
  browser_unsupported: "Ваш браузер не поддерживает голосовой ввод",
  unknown: "Произошла ошибка. Попробуйте снова",
};
