import type {
  CoreAssistantMessage,
  CoreToolMessage,
  UIMessage,
  UIMessagePart,
} from 'ai';
import { type ClassValue, clsx } from 'clsx';
import { formatISO } from 'date-fns';
import { twMerge } from 'tailwind-merge';
import type { DBMessage, Document } from '@/lib/db/schema';
import { ChatSDKError, type ErrorCode } from './errors';
import type { ChatMessage, ChatTools, CustomUIDataTypes } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const { code, cause } = await response.json();
    throw new ChatSDKError(code as ErrorCode, cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const { code, cause } = await response.json();
      throw new ChatSDKError(code as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ChatSDKError('offline:chat');
    }

    throw error;
  }
}

export function getLocalStorage(key: string) {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
  return [];
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(messages: UIMessage[]) {
  const userMessages = messages.filter((message) => message.role === 'user');
  return userMessages.at(-1);
}

export function getDocumentTimestampByIndex(
  documents: Document[],
  index: number,
) {
  if (!documents) { return new Date(); }
  if (index > documents.length) { return new Date(); }

  return documents[index].createdAt;
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) { return null; }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace('<has_function_call>', '');
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const parts = message.parts as UIMessagePart<CustomUIDataTypes, ChatTools>[];
    
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant' | 'system',
      parts: parts,
      metadata: {
        createdAt: formatISO(message.createdAt),
      },
    };
  });
}

export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/**
 * Оценка количества токенов для текста с учётом языка
 * Формула для русского текста: ~1.5-2.0 токена на слово
 * Формула для английского текста: ~1.3 токена на слово
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }

  const words = text.split(/\s+/).length;
  const chars = text.length;

  // Определяем язык (приблизительно)
  const cyrillicChars = (text.match(/[а-яёА-ЯЁ]/g) || []).length;
  const isCyrillic = cyrillicChars > chars * 0.3;

  if (isCyrillic) {
    // Для русского языка: учитываем среднюю длину слов
    const avgCharsPerWord = words > 0 ? chars / words : 0;
    if (avgCharsPerWord > 5) {
      // Длинные русские слова
      return Math.ceil(words * 2.0);
    }
    return Math.ceil(words * 1.7);
  }

  // Английский или смешанный текст
  return Math.ceil(words * 1.3);
}

/**
 * Оценка количества токенов для сообщения
 * Считает токены из text parts + добавляет overhead для метаданных
 */
export function estimateMessageTokens(parts: any[]): number {
  let total = 0;

  for (const part of parts) {
    if (part.type === 'text' && part.text) {
      total += estimateTokenCount(part.text);
    }
    // tool-call, step-start, step-finish и другие parts игнорируем
    // (они уже отфильтрованы при сохранении)
  }

  // Добавляем overhead для метаданных сообщения (role, id, timestamps, etc.)
  return total + 10;
}
