"use client";

import { ArrowLeft, ArrowUp, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateUUID } from "@/lib/utils";

// Контекст диалога
export type DialogContext = {
  type: "create-project";
  userProfile?: {
    displayName?: string | null;
    occupation?: string | null;
    bio?: string | null;
  };
};

// Результат создания проекта
export type ProjectResult = {
  id: string;
  name: string;
  description?: string;
  instruction?: string;
};

// Сообщение в диалоге
type DialogMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

interface UniversalDialogProps {
  context: DialogContext;
}

export function UniversalDialog({ context }: UniversalDialogProps) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DialogMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projectResult, setProjectResult] = useState<ProjectResult | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: DialogMessage = {
        id: generateUUID(),
        role: "user",
        content: input.trim(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);
      setStreamingContent("");

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Собрать все сообщения включая новое
      const allMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await fetch("/api/universal-dialog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: generateUUID(),
            messages: allMessages,
            context,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullContent += chunk;
            setStreamingContent(fullContent);

            // Проверяем, содержит ли ответ информацию о созданном проекте
            // Tool results приходят в формате JSON в конце
            if (chunk.includes('"success":true') && chunk.includes('"projectId"')) {
              try {
                // Попробуем извлечь JSON из ответа
                const jsonMatch = fullContent.match(/\{[^{}]*"success"\s*:\s*true[^{}]*"projectId"\s*:\s*"[^"]+"/);
                if (jsonMatch) {
                  // Ищем полный JSON объект
                  const startIndex = fullContent.lastIndexOf('{"success"');
                  if (startIndex !== -1) {
                    const jsonStr = fullContent.slice(startIndex);
                    const endIndex = jsonStr.indexOf('}') + 1;
                    if (endIndex > 0) {
                      const result = JSON.parse(jsonStr.slice(0, endIndex));
                      if (result.success && result.projectId) {
                        setProjectResult({
                          id: result.projectId,
                          name: result.projectName,
                          description: result.projectDescription,
                        });
                      }
                    }
                  }
                }
              } catch {
                // Ignore JSON parse errors, continue streaming
              }
            }
          }
        }

        // Проверяем, создан ли проект (парсим текстовый ответ AI)
        // AI может ответить: "идентификатор: UUID", "ID: UUID", "Его ID: `UUID`" и т.д.
        if (!projectResult) {
          const uuidPattern = /(?:идентификатор|ID)[:\s]+[`"]?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[`"]?/i;
          const uuidMatch = fullContent.match(uuidPattern);

          // Также попробуем извлечь название проекта
          const namePattern = /[Пп]роект\s+["«]([^"»]+)["»]/;
          const nameMatch = fullContent.match(namePattern);

          if (uuidMatch) {
            setProjectResult({
              id: uuidMatch[1],
              name: nameMatch ? nameMatch[1] : "Новый проект",
              description: undefined,
            });
          }
        }

        // Add assistant message
        const assistantMessage: DialogMessage = {
          id: generateUUID(),
          role: "assistant",
          content: fullContent,
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setStreamingContent("");
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // Request was aborted, ignore
          return;
        }
        console.error("[UniversalDialog] Error:", error);
        const errorMessage: DialogMessage = {
          id: generateUUID(),
          role: "assistant",
          content: "Произошла ошибка. Пожалуйста, попробуйте ещё раз.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, context]
  );

  // Отображение карточки-резюме если проект создан
  if (projectResult) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
          <div className="mb-4 text-center">
            <div className="mb-2 text-4xl">🎉</div>
            <h2 className="text-xl font-semibold">Проект создан!</h2>
          </div>

          <div className="mb-6 space-y-3">
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Название
              </div>
              <div className="text-lg font-medium">{projectResult.name}</div>
            </div>

            {projectResult.description && (
              <div>
                <div className="text-xs font-medium text-muted-foreground">
                  Описание
                </div>
                <div className="text-sm text-muted-foreground">
                  {projectResult.description}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button
              className="w-full"
              onClick={() => router.push(`/projects/${projectResult.id}`)}
            >
              Открыть проект →
            </Button>
            <Button
              className="w-full"
              onClick={() => router.push("/dashboard")}
              variant="outline"
            >
              На Главную
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur-sm">
        <Link href="/dashboard">
          <Button size="icon" variant="ghost">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="font-semibold">Новый проект</h1>
          <p className="text-xs text-muted-foreground">
            Расскажите о вашем проекте
          </p>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-2xl space-y-4">
          {/* Приветственное сообщение от Simply */}
          {messages.length === 0 && !streamingContent && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                S
              </div>
              <div className="rounded-2xl rounded-tl-none bg-muted px-4 py-3">
                <p>
                  Привет{context.userProfile?.displayName ? `, ${context.userProfile.displayName}` : ""}! 👋
                </p>
                <p className="mt-2">
                  Расскажите мне о проекте, который вы хотите создать. Что это
                  будет? Какая цель? Я помогу сформулировать паспорт проекта.
                </p>
              </div>
            </div>
          )}

          {/* Сообщения диалога */}
          {messages.map((message) => (
            <div
              className={`flex gap-3 ${
                message.role === "user" ? "flex-row-reverse" : ""
              }`}
              key={message.id}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  S
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "rounded-tr-none bg-primary text-primary-foreground"
                    : "rounded-tl-none bg-muted"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* Streaming content */}
          {streamingContent && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                S
              </div>
              <div className="max-w-[80%] rounded-2xl rounded-tl-none bg-muted px-4 py-3">
                <p className="whitespace-pre-wrap">{streamingContent}</p>
              </div>
            </div>
          )}

          {/* Индикатор загрузки (только если нет streaming content) */}
          {isLoading && !streamingContent && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                S
              </div>
              <div className="rounded-2xl rounded-tl-none bg-muted px-4 py-3">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t bg-background p-4">
        <form
          className="mx-auto flex max-w-2xl gap-2"
          onSubmit={handleSubmit}
        >
          <Textarea
            className="min-h-[44px] flex-1 resize-none"
            disabled={isLoading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Опишите ваш проект..."
            rows={1}
            value={input}
          />
          <Button
            disabled={!input.trim() || isLoading}
            size="icon"
            type="submit"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ArrowUp className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
