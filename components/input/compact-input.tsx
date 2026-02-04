"use client";

import { cn } from "@/lib/utils";
import {
  InputContextProvider,
  type InputProvider,
} from "./input-context";
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
import { InputModelSelector } from "./input-model-selector";
import { InputAttachments } from "./input-attachments";
import { InputSubmitButton } from "./input-submit-button";
import type { ProjectModelTier } from "@/lib/ai/model-tiers";

/**
 * CompactInput — готовый пресет для главной страницы и проекта
 *
 * Layout:
 * ╭──────────────────────────────────────────────────────╮
 * │  Спросите что угодно...                              │
 * ├──────────────────────────────────────────────────────┤
 * │  📎          Авто (рекомендуется) ▾      🎤    🔊   │
 * ╰──────────────────────────────────────────────────────╯
 */

interface CompactInputProps {
  // Provider: google (главная, helpers) или anthropic (проекты)
  provider: InputProvider;
  // Куда редиректить при отправке
  redirectPath: string;
  // Placeholder текст
  placeholder?: string;
  // Дополнительные классы
  className?: string;
  // Показывать кнопку attachments
  showAttachments?: boolean;
  // Default model/tier
  defaultModelId?: string;
  defaultTier?: ProjectModelTier;
}

export function CompactInput({
  provider,
  redirectPath,
  placeholder,
  className,
  showAttachments = true,
  defaultModelId = "auto",
  defaultTier = "expert",
}: CompactInputProps) {
  return (
    <InputContextProvider
      provider={provider}
      mode="redirect"
      redirectPath={redirectPath}
      defaultModelId={defaultModelId}
      defaultTier={defaultTier}
    >
      <InputBase className={cn("w-full", className)}>
        <InputContent>
          <InputTextarea
            placeholder={placeholder}
            autoFocus={false}
          />
        </InputContent>

        <InputToolbar>
          <InputToolbarLeft>
            {showAttachments && <InputAttachments />}
          </InputToolbarLeft>

          <InputToolbarRight>
            <InputModelSelector />
            <InputVoiceButton />
            <InputVoiceModeButton />
            <InputSubmitButton />
          </InputToolbarRight>
        </InputToolbar>
      </InputBase>
    </InputContextProvider>
  );
}
