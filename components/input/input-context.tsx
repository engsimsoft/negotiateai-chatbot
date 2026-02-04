"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import type { ProjectModelTier } from "@/lib/ai/model-tiers";

/**
 * Input Context
 * Связывает все компоненты инпута между собой
 */

export type InputProvider = "google" | "anthropic";
export type InputMode = "redirect" | "send";

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
}

export function InputContextProvider({
  children,
  provider,
  mode,
  redirectPath,
  onSubmit: onSubmitProp,
  disabled = false,
  defaultModelId = "auto",
  defaultTier = "expert",
}: InputProviderProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(defaultModelId);
  const [selectedTier, setSelectedTier] = useState<ProjectModelTier>(defaultTier);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load saved preferences from cookies
  useEffect(() => {
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
  }, [provider]);

  const canSubmit = value.trim().length > 0 && !isSubmitting && !disabled;

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isSubmitting || disabled) return;

    setIsSubmitting(true);

    const model = provider === "google" ? selectedModelId : selectedTier;

    if (mode === "redirect" && redirectPath) {
      const params = new URLSearchParams();
      params.set("query", trimmed);
      params.set("model", model);
      router.push(redirectPath + "?" + params.toString());
    } else if (onSubmitProp) {
      onSubmitProp(trimmed, model);
      setValue("");
    }

    setTimeout(() => setIsSubmitting(false), 300);
  }, [value, isSubmitting, disabled, mode, redirectPath, provider, selectedModelId, selectedTier, router, onSubmitProp]);

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
        isSubmitting,
        canSubmit,
        disabled,
      }}
    >
      {children}
    </InputContext.Provider>
  );
}
