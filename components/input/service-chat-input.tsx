"use client";

import { cn } from "@/lib/utils";
import { InputContextProvider } from "./input-context";
import {
  InputBase,
  InputContent,
  InputToolbar,
  InputToolbarLeft,
  InputToolbarRight,
} from "./input-base";
import { InputTextarea } from "./input-textarea";
import { InputVoiceButton } from "./input-voice-button";
import { InputVoiceModeButton } from "./input-voice-mode-button";
import { InputSubmitButton } from "./input-submit-button";

/**
 * ServiceChatInput — пресет для сервисных чатов (Бен, создание проекта)
 *
 * Использует controlled mode: value/onChange передаются извне.
 * Поддерживает голосовой ввод (диктовка + voice mode).
 *
 * Layout:
 * ╭──────────────────────────────────────────────────────╮
 * │  Опишите ваш проект...                               │
 * ├──────────────────────────────────────────────────────┤
 * │                           🎤 dictate   🔊 voice   ↑  │
 * ╰──────────────────────────────────────────────────────╯
 */

interface ServiceChatInputProps {
  /** Controlled value */
  value: string;
  /** Called when value changes */
  onChange: (value: string) => void;
  /** Called on submit (Enter or button click) */
  onSubmit: () => void;
  /** Loading state (streaming) */
  isLoading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Show dictation button (Deepgram STT) */
  showVoice?: boolean;
  /** Show voice mode button (future: full duplex) */
  showVoiceMode?: boolean;
  /** Additional classes */
  className?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

export function ServiceChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  placeholder = "Напишите сообщение...",
  showVoice = true,
  showVoiceMode = false,
  className,
  autoFocus = false,
}: ServiceChatInputProps) {
  return (
    <InputContextProvider
      provider="google"
      mode="controlled"
      value={value}
      onValueChange={onChange}
      onControlledSubmit={onSubmit}
      isLoading={isLoading}
      disabled={disabled}
    >
      <InputBase className={cn("w-full", className)}>
        <InputContent>
          <InputTextarea
            placeholder={placeholder}
            autoFocus={autoFocus}
          />
        </InputContent>

        <InputToolbar>
          <InputToolbarLeft>{null}</InputToolbarLeft>

          <InputToolbarRight>
            {showVoice && <InputVoiceButton />}
            {showVoiceMode && <InputVoiceModeButton />}
            <InputSubmitButton />
          </InputToolbarRight>
        </InputToolbar>
      </InputBase>
    </InputContextProvider>
  );
}
