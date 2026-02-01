/**
 * Audio constants for AssemblyAI streaming
 */

/** Sample rate required by AssemblyAI (16kHz) */
export const SAMPLE_RATE = 16000;

/** Buffer size for audio processing (256 samples = 16ms at 16kHz) */
export const BUFFER_SIZE = 256;

/** AssemblyAI WebSocket endpoint */
export const ASSEMBLYAI_WS_URL = "wss://api.assemblyai.com/v2/realtime/ws";

/** Speech model for multilingual support */
export const SPEECH_MODEL = "universal";

/** Token endpoint */
export const TOKEN_ENDPOINT = "/api/assemblyai/token";

/** Error messages in Russian */
export const VOICE_ERROR_MESSAGES: Record<string, string> = {
  permission_denied: "Разрешите доступ к микрофону в настройках браузера",
  no_microphone: "Микрофон не найден. Подключите микрофон и попробуйте снова",
  network_error: "Ошибка соединения. Проверьте интернет и попробуйте снова",
  api_error: "Ошибка сервиса распознавания. Попробуйте позже",
  browser_unsupported: "Ваш браузер не поддерживает голосовой ввод",
  unknown: "Произошла ошибка. Попробуйте снова",
};
