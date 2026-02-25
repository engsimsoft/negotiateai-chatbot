// ТЗ-Б2 Этап 3: Podcast player — full-screen centered player with artwork, controls, progress
// Apple-level design, matches prototype

"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PodcastTrack } from "@/hooks/use-podcast-player";

interface PodcastPlayerProps {
  tracks: PodcastTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  totalDuration: number;

  onTogglePlay: () => void;
  onSeekTo: (seconds: number) => void;
  onSetSpeed: (speed: number) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  /** Briefing date for artwork subtitle */
  briefingDate?: string;
  /** ТЗ-Б2 Этап 5: Podcast is outdated (article updated after generation) */
  isOutdated?: boolean;
  /** Re-record a single track by topicId */
  onRerecordTrack?: (topicId: string) => void;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5];

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  if (m === 0) return `${s} сек`;
  if (s === 0) return `${m} мин`;
  return `${m} мин ${s} сек`;
}

/** CSS-only sound wave animation on artwork */
function SoundWave({ animate }: { animate: boolean }) {
  const bars = [12, 20, 28, 36, 24, 32, 16, 28, 20, 12];
  return (
    <div className="mt-3 flex items-center gap-[3px]" style={{ height: 36 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-sm bg-primary-foreground/60"
          style={{
            height: h,
            animation: animate
              ? `podcast-wave 1.2s ease-in-out ${i * 0.1}s infinite`
              : "none",
            transform: animate ? undefined : "scaleY(0.3)",
            transition: "transform 0.4s ease",
          }}
        />
      ))}
    </div>
  );
}

export function PodcastPlayer({
  tracks,
  currentTrackIndex,
  isPlaying,
  currentTime,
  duration,
  speed,
  totalDuration,
  onTogglePlay,
  onSeekTo,
  onSetSpeed,
  onNextTrack,
  onPrevTrack,
  onSkipForward,
  onSkipBackward,
  briefingDate,
  isOutdated,
  onRerecordTrack,
}: PodcastPlayerProps) {
  const progressRef = useRef<HTMLDivElement>(null);

  const currentTrack = tracks[currentTrackIndex];
  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeekTo(fraction * duration);
    },
    [duration, onSeekTo],
  );

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(currentTrack.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentTrack.emoji} ${currentTrack.topicName}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(currentTrack.url, "_blank");
    }
  }, [currentTrack]);

  // Format date for artwork subtitle
  const dateLabel = briefingDate
    ? new Date(briefingDate).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "long",
      })
    : undefined;

  // Download all tracks merged into one MP3 (client-side concat — MP3 is a streaming format)
  const [isMerging, setIsMerging] = useState(false);
  const handleDownloadAll = useCallback(async () => {
    if (tracks.length < 2) return;
    setIsMerging(true);
    try {
      const buffers = await Promise.all(
        tracks.map((t) => fetch(t.url).then((r) => r.arrayBuffer())),
      );
      const merged = new Blob(buffers, { type: "audio/mpeg" });
      const url = URL.createObjectURL(merged);
      const a = document.createElement("a");
      a.href = url;
      const label = dateLabel ?? "подкаст";
      a.download = `Утренний брифинг — ${label}.mp3`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: nothing critical
    } finally {
      setIsMerging(false);
    }
  }, [tracks, dateLabel]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-8">
      {/* ТЗ-Б2 Этап 5: Outdated banner */}
      {isOutdated && (
        <div className="mb-4 w-full max-w-md rounded-lg bg-warning/10 px-4 py-2 text-center text-sm text-warning">
          Текст обновлён, подкаст может быть неактуален
        </div>
      )}

      {/* Meta line */}
      <p className="mb-2 text-center text-[13px] text-muted-foreground">
        {tracks.length} {tracks.length === 1 ? "тема" : tracks.length < 5 ? "темы" : "тем"} · {formatDuration(totalDuration)}
      </p>

      {/* Artwork */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="relative mb-8 flex size-52 flex-col items-center justify-center overflow-hidden rounded-3xl bg-primary shadow-lg md:size-64"
      >
        {/* Radial highlight */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.15)_0%,transparent_60%)]" />

        {/* Icon */}
        <div className="relative z-10">
          <Mic className="size-14 text-primary-foreground md:size-16" />
        </div>

        {/* Title */}
        <p className="relative z-10 mt-2 font-serif text-lg font-semibold text-primary-foreground md:text-xl">
          Утренний брифинг
        </p>

        {/* Date */}
        {dateLabel && (
          <p className="relative z-10 text-sm text-primary-foreground/80">
            {dateLabel}
          </p>
        )}

        {/* Sound wave */}
        <div className="relative z-10">
          <SoundWave animate={isPlaying} />
        </div>
      </motion.div>

      {/* Track info + re-record */}
      <div className="mb-6 flex items-center justify-center gap-2">
        <p className="text-[15px] font-semibold text-primary">
          {currentTrack.emoji} {currentTrack.topicName}
        </p>
        {onRerecordTrack && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onRerecordTrack(currentTrack.topicId)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                >
                  <RefreshCw className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Перезаписать</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6 w-full max-w-md">
        <div
          ref={progressRef}
          className="relative h-1.5 cursor-pointer rounded-full bg-border"
          onClick={handleProgressClick}
        >
          <div
            className="relative h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          >
            {/* Thumb */}
            <div
              className="absolute -right-2 -top-1.25 size-4 rounded-full bg-primary shadow-md"
            />
          </div>
        </div>
        <div className="mt-1.5 flex justify-between text-[13px] tabular-nums text-muted-foreground">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls — min 44px touch targets for mobile */}
      <TooltipProvider delayDuration={300}>
        <div className="mb-6 flex items-center gap-4 sm:gap-6">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onPrevTrack}
                className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <SkipBack className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Предыдущая</TooltipContent>
          </Tooltip>

          <button
            type="button"
            onClick={onSkipBackward}
            className="flex size-11 items-center justify-center text-lg font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            -15
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause className="size-6" />
            ) : (
              <Play className="ml-0.5 size-6" />
            )}
          </button>

          <button
            type="button"
            onClick={onSkipForward}
            className="flex size-11 items-center justify-center text-lg font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            +15
          </button>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNextTrack}
                className="flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <SkipForward className="size-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Следующая</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Speed pills + Download */}
      <TooltipProvider delayDuration={300}>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSetSpeed(s)}
                className={`rounded-2xl border px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-150 ${
                  speed === s
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {s}×
              </button>
            ))}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-2xl border border-border px-3.5 py-1.5 text-[13px] text-muted-foreground transition-all duration-150 hover:border-primary hover:text-primary"
              >
                <Download className="size-3.5" />
                MP3
              </button>
            </TooltipTrigger>
            <TooltipContent>Скачать трек</TooltipContent>
          </Tooltip>

          {tracks.length >= 2 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  disabled={isMerging}
                  className="flex items-center gap-1.5 rounded-2xl border border-border px-3.5 py-1.5 text-[13px] text-muted-foreground transition-all duration-150 hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  {isMerging ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                  Всё
                </button>
              </TooltipTrigger>
              <TooltipContent>Весь подкаст одним файлом</TooltipContent>
            </Tooltip>
          )}
        </div>
      </TooltipProvider>
    </div>
  );
}
