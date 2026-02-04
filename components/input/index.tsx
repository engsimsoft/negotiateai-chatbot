/**
 * Input Components
 *
 * Унифицированная система инпутов для всего приложения.
 * Меняем один раз — работает везде.
 *
 * Готовые пресеты:
 * - CompactInput — для главной, проекта, helpers (redirect mode)
 *
 * Атомарные компоненты (для кастомных сборок):
 * - InputBase, InputContent, InputToolbar
 * - InputTextarea
 * - InputVoiceButton, InputVoiceModeButton
 * - InputModelSelector
 * - InputAttachments
 * - InputSubmitButton
 */

// Context
export {
  InputContextProvider,
  useInputContext,
  useInputContextSafe,
  type InputProvider,
  type InputMode,
} from "./input-context";

// Base components
export {
  InputBase,
  InputContent,
  InputToolbar,
  InputToolbarLeft,
  InputToolbarRight,
} from "./input-base";

// Atomic components
export { InputTextarea } from "./input-textarea";
export { InputVoiceButton } from "./input-voice-button";
export { InputVoiceModeButton } from "./input-voice-mode-button";
export { InputModelSelector } from "./input-model-selector";
export { InputAttachments } from "./input-attachments";
export { InputSubmitButton } from "./input-submit-button";

// Ready-to-use presets
export { CompactInput } from "./compact-input";
