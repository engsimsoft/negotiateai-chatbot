"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import type { ProjectModelTier } from "@/lib/ai/model-tiers";

/**
 * Input Context
 * Связывает все компоненты инпута между собой
 *
 * Поддерживает два режима:
 * - Uncontrolled: контекст управляет своим state (redirect/send mode)
 * - Controlled: value/onChange передаются извне (streaming mode)
 */

export type InputProvider = "google" | "anthropic";
export type InputMode = "redirect" | "send" | "controlled";

interface InputContextValue {
  // Text
  value: string;
  setValue: Dispatch<SetStateAction<string>>;

  // Focus
  isFocused: boolean;
  setIsFocused: Dispatch<SetStateAction<boolean>>;

  // Provider & Model
  provider: InputProvider;
  selectedModelId: string;
  setSelectedModelId: Dispatch<SetStateAction<string>>;
  selectedTier: ProjectModelTier;
  setSelectedTier: Dispatch<SetStateAction<ProjectModelTier>>;

  // Mode & Navigation
  mode: InputMode;
  redirectPath?: string;

  // Submit
  handleSubmit: () => void;
  isSubmitting: boolean;
  canSubmit: boolean;

  // Disabled state
  disabled: boolean;
}

const InputContext = createContext<InputContextValue | null>(null);

export function useInputContext() {
  const context = useContext(InputContext);
  if (!context) {
    throw new Error("useInputContext must be used within InputProvider");
  }
  return context;
}

export function useInputContextSafe() {
  return useContext(InputContext);
}

interface InputProviderProps {
  children: ReactNode;
  provider: InputProvider;
  mode: InputMode;
  redirectPath?: string;
  onSubmit?: (value: string, model: string) => void;
  disabled?: boolean;
  defaultModelId?: string;
  defaultTier?: ProjectModelTier;

  // Controlled mode props (for streaming chats)
  value?: string;
  onValueChange?: (value: string) => void;
  onControlledSubmit?: () => void;
  isLoading?: boolean;
}

export function InputContextProvider({
  children,
  provider,
  mode,
  redirectPath,
  onSubmit: onSubmitProp,
  disabled = false,
  defaultModelId = "claude-sonnet",
  defaultTier = "expert",
  // Controlled mode props
  value: controlledValue,
  onValueChange,
  onControlledSubmit,
  isLoading: controlledIsLoading,
}: InputProviderProps) {
  const router = useRouter();

  // Internal state for uncontrolled mode
  const [internalValue, setInternalValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);
  const [selectedTier, setSelectedTier] = useState<ProjectModelTier>(defaultTier);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Determine if controlled mode
  const isControlled = mode === "controlled";

  // Use controlled or internal value
  const value = isControlled ? (controlledValue ?? "") : internalValue;

  // Ref to track current value for functional updates (prevents stale closure in rapid callbacks like voice dictation)
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const setValue: Dispatch<SetStateAction<string>> = useCallback(
    (action) => {
      if (isControlled && onValueChange) {
        // Use ref for functional updates to get fresh value
        const newValue = typeof action === "function" ? action(valueRef.current) : action;
        onValueChange(newValue);
      } else {
        setInternalValue(action);
      }
    },
    [isControlled, onValueChange]
  );

  // Loading state
  const isSubmittingState = isControlled ? (controlledIsLoading ?? false) : isSubmitting;

  // Load saved preferences from cookies (only for uncontrolled modes)
  useEffect(() => {
    if (isControlled) return;

    if (provider === "google") {
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("chat-model="));
      if (cookie) {
        setSelectedModelId(cookie.split("=")[1]);
      }
    } else {
      const cookie = document.cookie
        .split("; ")
        .find((row) => row.startsWith("project-model-tier="));
      if (cookie) {
        setSelectedTier(cookie.split("=")[1] as ProjectModelTier);
      }
    }
  }, [provider, isControlled]);

  const canSubmit = value.trim().length > 0 && !isSubmittingState && !disabled;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isSubmittingState || disabled) return;

    // Controlled mode: call external submit handler
    if (isControlled && onControlledSubmit) {
      onControlledSubmit();
      return;
    }

    // Uncontrolled modes
    setIsSubmitting(true);

    const model = provider === "google" ? selectedModelId : selectedTier;

    if (mode === "redirect" && redirectPath) {
      const params = new URLSearchParams();
      params.set("query", trimmed);
      params.set("model", model);
      router.push(redirectPath + "?" + params.toString());
    } else if (onSubmitProp) {
      onSubmitProp(trimmed, model);
      setInternalValue("");
    }

    setTimeout(() => setIsSubmitting(false), 300);
  }, [value, isSubmittingState, disabled, isControlled, onControlledSubmit, mode, redirectPath, provider, selectedModelId, selectedTier, router, onSubmitProp]);

  return (
    <InputContext.Provider
      value={{
        value,
        setValue,
        isFocused,
        setIsFocused,
        provider,
        selectedModelId,
        setSelectedModelId,
        selectedTier,
        setSelectedTier,
        mode,
        redirectPath,
        handleSubmit,
        isSubmitting: isSubmittingState,
        canSubmit,
        disabled,
      }}
    >
      {children}
    </InputContext.Provider>
  );
}
