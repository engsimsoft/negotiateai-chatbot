// ТЗ-Б2 Этап 3: Hook for podcast audio player
// Manages <audio> element, track switching, speed, seek, progress

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AudioUrls, AudioDurations } from "@/lib/briefing/briefing-types";

export interface PodcastTrack {
  topicId: string;
  url: string;
  durationSeconds: number;
  emoji: string;
  topicName: string;
}

interface UsePodcastPlayerReturn {
  /** Ordered list of playable tracks */
  tracks: PodcastTrack[];
  /** Index of currently active track */
  currentTrackIndex: number;
  /** Whether audio is playing */
  isPlaying: boolean;
  /** Current playback position in seconds */
  currentTime: number;
  /** Duration of current track in seconds (from audio element) */
  duration: number;
  /** Current playback speed */
  speed: number;
  /** Total duration of all tracks in seconds */
  totalDuration: number;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  setSpeed: (speed: number) => void;
  setTrack: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  skipForward: () => void;
  skipBackward: () => void;
}

interface TrackInfo {
  topicId: string;
  emoji: string;
  topicName: string;
}

export function usePodcastPlayer(
  audioUrls: AudioUrls,
  audioDurations: AudioDurations,
  /** Topic info in order (to build track list) */
  trackInfos: TrackInfo[],
): UsePodcastPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1);

  // Build ordered track list (only topics with audio)
  const tracks: PodcastTrack[] = trackInfos
    .filter((t) => audioUrls[t.topicId])
    .map((t) => ({
      topicId: t.topicId,
      url: audioUrls[t.topicId],
      durationSeconds: audioDurations[t.topicId] ?? 0,
      emoji: t.emoji,
      topicName: t.topicName,
    }));

  const totalDuration = tracks.reduce((sum, t) => sum + t.durationSeconds, 0);

  // Lazy-create audio element (SSR-safe)
  const getAudio = useCallback(() => {
    if (!audioRef.current && typeof window !== "undefined") {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }, []);

  // Sync audio source when track changes
  useEffect(() => {
    const audio = getAudio();
    if (!audio || tracks.length === 0) return;

    const track = tracks[currentTrackIndex];
    if (!track) return;

    const wasPlaying = !audio.paused;
    audio.src = track.url;
    audio.playbackRate = speed;

    if (wasPlaying) {
      audio.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrackIndex, tracks.length > 0 ? tracks[currentTrackIndex]?.url : null]);

  // Time update listener
  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      // Auto-play next track
      if (currentTrackIndex < tracks.length - 1) {
        setCurrentTrackIndex((i) => i + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [getAudio, currentTrackIndex, tracks.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  const play = useCallback(() => {
    getAudio()?.play().catch(() => {});
  }, [getAudio]);

  const pause = useCallback(() => {
    getAudio()?.pause();
  }, [getAudio]);

  const togglePlay = useCallback(() => {
    const audio = getAudio();
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [getAudio]);

  const seekTo = useCallback(
    (seconds: number) => {
      const audio = getAudio();
      if (!audio) return;
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || 0));
    },
    [getAudio],
  );

  const setSpeed = useCallback(
    (newSpeed: number) => {
      setSpeedState(newSpeed);
      const audio = getAudio();
      if (audio) audio.playbackRate = newSpeed;
    },
    [getAudio],
  );

  const setTrack = useCallback(
    (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      setCurrentTime(0);
      setCurrentTrackIndex(index);
    },
    [tracks.length],
  );

  const nextTrack = useCallback(() => {
    if (currentTrackIndex < tracks.length - 1) {
      setTrack(currentTrackIndex + 1);
    }
  }, [currentTrackIndex, tracks.length, setTrack]);

  const prevTrack = useCallback(() => {
    const audio = getAudio();
    // If more than 3 seconds in, restart current track
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
    } else if (currentTrackIndex > 0) {
      setTrack(currentTrackIndex - 1);
    }
  }, [currentTrackIndex, getAudio, setTrack]);

  const skipForward = useCallback(() => {
    const audio = getAudio();
    if (audio) audio.currentTime = Math.min(audio.currentTime + 15, audio.duration || 0);
  }, [getAudio]);

  const skipBackward = useCallback(() => {
    const audio = getAudio();
    if (audio) audio.currentTime = Math.max(audio.currentTime - 15, 0);
  }, [getAudio]);

  return {
    tracks,
    currentTrackIndex,
    isPlaying,
    currentTime,
    duration,
    speed,
    totalDuration,
    play,
    pause,
    togglePlay,
    seekTo,
    setSpeed,
    setTrack,
    nextTrack,
    prevTrack,
    skipForward,
    skipBackward,
  };
}
