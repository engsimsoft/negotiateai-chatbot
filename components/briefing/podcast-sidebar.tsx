// ТЗ-Б2 Этап 4+5: Podcast tracklist section for sidebar
// Shows tracks with duration, current track highlight, equalizer animation
// Этап 5: Failed topics shown gray with retry button

"use client";

import { Headphones, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PodcastTrack } from "@/hooks/use-podcast-player";

/** Topic that failed generation (shown gray in tracklist with retry) */
export interface FailedPodcastTopic {
  topicId: string;
  emoji: string;
  topicName: string;
}

export interface PodcastSidebarTracklistProps {
  tracks: PodcastTrack[];
  currentTrackIndex: number;
  isPlaying: boolean;
  onSelectTrack: (index: number) => void;
  /** ТЗ-Б2 Этап 5: Topics that failed generation */
  failedTopics?: FailedPodcastTopic[];
  /** ТЗ-Б2 Этап 5: Retry a single failed topic */
  onRetryTopic?: (topicId: string) => void;
}

function formatTrackDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatTotalDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  if (m === 0) return `${Math.floor(totalSeconds)} сек`;
  return `${m} мин`;
}

/** Mini equalizer animation for currently playing track (CSS-only, uses podcast-equalizer keyframes from globals.css) */
function MiniEqualizer() {
  return (
    <div className="flex items-center gap-px" style={{ height: 12 }}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <div
          key={i}
          className="w-[2.5px] rounded-sm bg-primary"
          style={{
            height: 12,
            animation: `podcast-equalizer 0.6s ease-in-out ${delay}s infinite alternate`,
            transformOrigin: "bottom",
          }}
        />
      ))}
    </div>
  );
}

/**
 * ТЗ-Б2 Этап 4+5: Tracklist section for BriefingSidebar.
 * Shows when viewMode === "listen" and tracks are available.
 * Replaces "Текущий выпуск" topic navigation with playable track list.
 * Этап 5: Failed topics shown gray with retry.
 */
export function PodcastSidebarTracklist({
  tracks,
  currentTrackIndex,
  isPlaying,
  onSelectTrack,
  failedTopics = [],
  onRetryTopic,
}: PodcastSidebarTracklistProps) {
  if (tracks.length === 0 && failedTopics.length === 0) return null;

  const totalDuration = tracks.reduce((sum, t) => sum + t.durationSeconds, 0);

  return (
    <>
      <p className="mb-2 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Headphones className="size-3" />
        Треклист
      </p>

      {/* Full episode summary */}
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1.5 text-sm text-muted-foreground">
        <span>
          {tracks.length}{" "}
          {tracks.length === 1 ? "тема" : tracks.length < 5 ? "темы" : "тем"}
        </span>
        <span>·</span>
        <span>{formatTotalDuration(totalDuration)}</span>
      </div>

      {/* Track list — ready tracks */}
      {tracks.map((track, index) => {
        const isCurrent = index === currentTrackIndex;
        return (
          <button
            key={track.topicId}
            type="button"
            onClick={() => onSelectTrack(index)}
            className={cn(
              "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-all duration-150 hover:bg-muted/60",
              isCurrent && "bg-primary/10 font-medium text-primary",
            )}
          >
            {/* Equalizer for playing track, emoji otherwise */}
            <span className="flex size-4 shrink-0 items-center justify-center">
              {isCurrent && isPlaying ? (
                <MiniEqualizer />
              ) : (
                <span>{track.emoji}</span>
              )}
            </span>
            <span className="min-w-0 truncate">{track.topicName}</span>
            <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
              {formatTrackDuration(track.durationSeconds)}
            </span>
          </button>
        );
      })}

      {/* ТЗ-Б2 Этап 5: Failed topics — gray with retry */}
      {failedTopics.length > 0 && (
        <>
          {failedTopics.map((topic) => (
            <div
              key={topic.topicId}
              className="mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground/60"
            >
              <span className="flex size-4 shrink-0 items-center justify-center opacity-50">
                {topic.emoji}
              </span>
              <span className="min-w-0 truncate">{topic.topicName}</span>
              {onRetryTopic && (
                <button
                  type="button"
                  onClick={() => onRetryTopic(topic.topicId)}
                  className="ml-auto shrink-0 rounded p-1 text-muted-foreground transition-colors hover:text-primary"
                >
                  <RefreshCw className="size-3" />
                </button>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}
