"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SparklesIcon } from "./icons";
import type { ArtifactKind } from "./artifact";

// ===========================================
// Status Messages Configuration
// ===========================================

interface StatusMessage {
  text: string;
  duration: number; // ms to display before switching
}

const getStatusMessages = (artifactKind: ArtifactKind): StatusMessage[] => {
  const commonMessages: StatusMessage[] = [
    { text: "Думаю...", duration: 2000 },
    { text: "Анализирую запрос...", duration: 2500 },
  ];

  const artifactSpecificMessages: Record<ArtifactKind, StatusMessage[]> = {
    excel: [
      { text: "Генерирую таблицу...", duration: 2500 },
      { text: "Рассчитываю формулы...", duration: 2000 },
      { text: "Форматирую данные...", duration: 2000 },
      { text: "Создаю графики...", duration: 2500 },
    ],
    markdown: [
      { text: "Создаю документ...", duration: 2500 },
      { text: "Форматирую текст...", duration: 2000 },
      { text: "Структурирую содержимое...", duration: 2500 },
    ],
    text: [
      { text: "Пишу текст...", duration: 2500 },
      { text: "Редактирую формулировки...", duration: 2000 },
      { text: "Проверяю стиль...", duration: 2000 },
    ],
    image: [
      { text: "Генерирую изображение...", duration: 3000 },
      { text: "Обрабатываю пиксели...", duration: 2500 },
      { text: "Применяю стили...", duration: 2000 },
    ],
    "presentation-reveal": [
      { text: "Создаю презентацию...", duration: 2500 },
      { text: "Генерирую слайды...", duration: 2500 },
      { text: "Добавляю анимации...", duration: 2000 },
    ],
    "presentation-pptx": [
      { text: "Создаю PowerPoint...", duration: 2500 },
      { text: "Генерирую слайды...", duration: 2500 },
      { text: "Экспортирую файл...", duration: 2000 },
    ],
  };

  return [...commonMessages, ...(artifactSpecificMessages[artifactKind] || [])];
};

// ===========================================
// Character Sets for Code Rain
// ===========================================

const getCharacterSet = (artifactKind: ArtifactKind): string[] => {
  switch (artifactKind) {
    case "excel":
      return ["=", "SUM", "$", "%", "A1", "B2", "IF", "∑", "→", "÷", "×", "#", "ИТОГО"];
    case "markdown":
      return ["#", "##", "**", "_", ">", "-", "[", "]", "(", ")", "`", "---", "```", "•"];
    case "text":
      return ["А", "Б", "В", "Г", "Д", "...", "→", "•", "¶", "«", "»", "—"];
    case "image":
      return ["px", "RGB", "α", "□", "○", "▲", "◇", "∿", "≋", "HSL", "%"];
    case "presentation-reveal":
    case "presentation-pptx":
      return ["→", "•", "1.", "2.", "3.", "◆", "▸", "≡", "⊞", "⬚", "Слайд"];
    default:
      return ["{", "}", "<", ">", "/", "=", "(", ")", ";", "const", "let", "if", "=>"];
  }
};

// ===========================================
// Custom Hooks
// ===========================================

const useRotatingStatus = (messages: StatusMessage[]): string => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (messages.length === 0) return;

    const currentDuration = messages[currentIndex]?.duration || 2000;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, currentDuration);

    return () => clearTimeout(timer);
  }, [currentIndex, messages]);

  return messages[currentIndex]?.text || "Загрузка...";
};

// ===========================================
// Code Rain Column Component
// ===========================================

const CodeRainColumn = memo(function CodeRainColumn({
  characters,
  columnIndex,
  totalColumns,
}: {
  characters: string[];
  columnIndex: number;
  totalColumns: number;
}) {
  const delay = (columnIndex / totalColumns) * 2.5;
  const duration = 2.5 + Math.random() * 2;

  // Pick random characters for this column
  const columnChars = useMemo(() => {
    return Array.from({ length: 6 }, () =>
      characters[Math.floor(Math.random() * characters.length)]
    );
  }, [characters]);

  return (
    <div
      className="code-rain-column absolute flex flex-col gap-3 font-mono text-xs text-muted-foreground/50"
      style={
        {
          left: `${(columnIndex / totalColumns) * 100}%`,
          "--fall-delay": `${delay}s`,
          "--fall-duration": `${duration}s`,
        } as React.CSSProperties
      }
    >
      {columnChars.map((char, i) => (
        <span
          key={i}
          className="select-none"
          style={{ opacity: 0.3 + Math.random() * 0.4 }}
        >
          {char}
        </span>
      ))}
    </div>
  );
});

// ===========================================
// Main Artifact Loading Content
// ===========================================

const ArtifactLoadingContent = memo(function ArtifactLoadingContent({
  artifactKind,
}: {
  artifactKind: ArtifactKind;
}) {
  const characters = useMemo(() => getCharacterSet(artifactKind), [artifactKind]);
  const messages = useMemo(() => getStatusMessages(artifactKind), [artifactKind]);
  const currentStatus = useRotatingStatus(messages);

  const columnCount = 10;

  return (
    <div className="relative flex h-[calc(100dvh-120px)] w-full flex-col items-center justify-center overflow-hidden">
      {/* Background Code Rain Effect */}
      <div className="absolute inset-0 overflow-hidden opacity-40 dark:opacity-25">
        {Array.from({ length: columnCount }).map((_, i) => (
          <CodeRainColumn
            key={i}
            characters={characters}
            columnIndex={i}
            totalColumns={columnCount}
          />
        ))}
      </div>

      {/* Central Loading Indicator */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 flex flex-col items-center gap-5"
      >
        {/* Animated Icon with Glow */}
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="artifact-shimmer-glow flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-primary/20"
        >
          <SparklesIcon size={28} />
        </motion.div>

        {/* Status Message with Smooth Transition */}
        <div className="flex h-6 items-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={currentStatus}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-sm font-medium text-muted-foreground"
            >
              {currentStatus}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Pulsing Dots Progress Indicator */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                delay: i * 0.2,
                ease: "easeInOut",
              }}
              className="size-2 rounded-full bg-primary/60"
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
});

// ===========================================
// Exported Components
// ===========================================

export const DocumentSkeleton = ({
  artifactKind,
}: {
  artifactKind: ArtifactKind;
}) => {
  // For image artifacts, use a different centered layout
  if (artifactKind === "image") {
    return (
      <div className="flex h-[calc(100dvh-60px)] w-full flex-col items-center justify-center">
        <ArtifactLoadingContent artifactKind={artifactKind} />
      </div>
    );
  }

  return <ArtifactLoadingContent artifactKind={artifactKind} />;
};

// Keep InlineDocumentSkeleton for backwards compatibility (sidebar previews, etc.)
export const InlineDocumentSkeleton = () => {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="h-4 w-48 animate-pulse rounded-lg bg-muted-foreground/20" />
      <div className="h-4 w-3/4 animate-pulse rounded-lg bg-muted-foreground/20" />
      <div className="h-4 w-1/2 animate-pulse rounded-lg bg-muted-foreground/20" />
      <div className="h-4 w-64 animate-pulse rounded-lg bg-muted-foreground/20" />
      <div className="h-4 w-40 animate-pulse rounded-lg bg-muted-foreground/20" />
    </div>
  );
};
