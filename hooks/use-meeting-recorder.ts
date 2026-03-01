"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecorderState = "idle" | "recording" | "paused" | "stopped";

interface UseMeetingRecorderReturn {
  state: RecorderState;
  /** Elapsed recording time in seconds */
  elapsed: number;
  /** Recorded audio blob (available after stop) */
  blob: Blob | null;
  /** MIME type of the recorded audio */
  mimeType: string;
  /** Object URL for playback (available after stop) */
  audioUrl: string | null;
  /** Error message if something went wrong */
  error: string | null;
  /** Whether browser supports MediaRecorder */
  isSupported: boolean;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  reset: () => void;
}

const MAX_DURATION_SECONDS = 3 * 60 * 60; // 3 hours

/** Detect best supported audio MIME type */
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

export function useMeetingRecorder(): UseMeetingRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("audio/webm");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const type = getSupportedMimeType();
      setMimeType(type);

      const recorder = new MediaRecorder(stream, { mimeType: type });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const recordedBlob = new Blob(chunksRef.current, { type });
        setBlob(recordedBlob);

        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);

        // Stop all tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.onerror = () => {
        setError("Ошибка записи. Проверьте доступ к микрофону.");
        setState("idle");
        stopTimer();
      };

      // Request data every 1 second (smaller chunks for reliability)
      recorder.start(1000);
      setState("recording");
      setElapsed(0);
      startTimer();

      // Auto-stop at max duration
      maxTimerRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
          setState("stopped");
          stopTimer();
        }
      }, MAX_DURATION_SECONDS * 1000);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Доступ к микрофону запрещён. Разрешите в настройках браузера.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("Микрофон не найден.");
      } else {
        setError("Не удалось начать запись.");
      }
      setState("idle");
    }
  }, [startTimer, stopTimer]);

  const pause = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause();
      setState("paused");
      stopTimer();
    }
  }, [stopTimer]);

  const resume = useCallback(() => {
    if (recorderRef.current?.state === "paused") {
      recorderRef.current.resume();
      setState("recording");
      startTimer();
    }
  }, [startTimer]);

  const stop = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
      setState("stopped");
      stopTimer();
    }
  }, [stopTimer]);

  const reset = useCallback(() => {
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    stopTimer();
    setState("idle");
    setElapsed(0);
    setBlob(null);
    setAudioUrl(null);
    setError(null);
    chunksRef.current = [];
  }, [audioUrl, stopTimer]);

  return {
    state,
    elapsed,
    blob,
    mimeType,
    audioUrl,
    error,
    isSupported,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}

/** Format seconds into HH:MM:SS */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
