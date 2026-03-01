"use client";

import { useState, useRef, useCallback } from "react";
import {
  Mic,
  Square,
  Pause,
  Play,
  Upload,
  FileAudio,
  Loader2,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetingRecorder, formatDuration } from "@/hooks/use-meeting-recorder";

type PageState = "input" | "ready" | "uploading" | "processing" | "result";
type SummaryLevel = "compact" | "standard" | "detailed";

const SUMMARY_OPTIONS: { value: SummaryLevel; label: string; description: string }[] = [
  { value: "compact", label: "Сводка", description: "Ключевые решения и задачи (~1 стр)" },
  { value: "standard", label: "Протокол", description: "Темы, решения, задачи, вопросы (~2-3 стр)" },
  { value: "detailed", label: "Детальный", description: "Полная хронология с тайм-кодами" },
];

const ACCEPTED_AUDIO_TYPES = ".mp3,.m4a,.wav,.webm,.ogg,.aac,.flac";

export function MeetingPage() {
  const recorder = useMeetingRecorder();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("input");
  const [summaryLevel, setSummaryLevel] = useState<SummaryLevel>("standard");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      setError("Файл слишком большой. Максимум 200 МБ.");
      return;
    }

    setError(null);
    setAudioFile(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setPageState("ready");

    // Get duration from audio element
    const audio = new Audio(url);
    audio.addEventListener("loadedmetadata", () => {
      setAudioDuration(Math.round(audio.duration));
    });
  }, []);

  // Handle recorder stop → transition to ready
  const handleRecorderStop = useCallback(() => {
    recorder.stop();
    // The recorder hook sets blob and audioUrl on stop
    setTimeout(() => {
      setPageState("ready");
    }, 100);
  }, [recorder]);

  // Upload audio to Vercel Blob, then trigger processing
  const handleCreateDocument = useCallback(async () => {
    setError(null);

    // Determine the source: recorder blob or uploaded file
    const source = recorder.blob ?? audioFile;
    if (!source) {
      setError("Нет аудиофайла для обработки.");
      return;
    }

    try {
      setPageState("uploading");
      setUploadProgress(0);

      // Upload to Vercel Blob via server-side FormData route
      const filename = audioFile?.name ?? `meeting-${Date.now()}.webm`;
      const formData = new FormData();
      formData.append("file", source);
      formData.append("filename", filename);

      const res = await fetch("/api/meeting/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const { url } = await res.json();
      setBlobUrl(url);
      setUploadProgress(100);

      // Duration: from recorder elapsed or from file metadata
      const duration = recorder.elapsed > 0 ? recorder.elapsed : audioDuration;

      // TODO Этап 3: trigger /api/meeting/process with blobUrl + summaryLevel + duration
      console.log("[meeting] Uploaded to blob:", url, "level:", summaryLevel, "duration:", duration);

      // For now, show success placeholder
      setPageState("result");
    } catch (err) {
      console.error("[meeting] Upload error:", err);
      setError(err instanceof Error ? err.message : "Ошибка загрузки файла. Попробуйте ещё раз.");
      setPageState("ready");
    }
  }, [recorder.blob, recorder.elapsed, audioFile, audioDuration, summaryLevel]);

  // Reset everything
  const handleReset = useCallback(() => {
    recorder.reset();
    setPageState("input");
    setSummaryLevel("standard");
    setAudioFile(null);
    if (audioUrl && !recorder.audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioDuration(0);
    setBlobUrl(null);
    setUploadProgress(0);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [recorder, audioUrl]);

  // Current audio URL (from recorder or file)
  const currentAudioUrl = recorder.audioUrl ?? audioUrl;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-8 lg:px-6">
      {/* Error banner */}
      {(error || recorder.error) && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error || recorder.error}
        </div>
      )}

      {/* ===== INPUT STATE ===== */}
      {pageState === "input" && recorder.state === "idle" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          {/* Record button */}
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={recorder.start}
              disabled={!recorder.isSupported}
              className="relative flex size-28 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Mic className="size-10" />
            </button>
            <p className="text-sm text-muted-foreground">
              Нажмите для записи
            </p>
          </div>

          {/* Divider */}
          <div className="flex w-full max-w-xs items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">или</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* File upload */}
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="size-4" />
              Загрузить аудиофайл
            </Button>
            <p className="text-xs text-muted-foreground">
              MP3, M4A, WAV, WebM, OGG — до 200 МБ
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_AUDIO_TYPES}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* ===== RECORDING STATE ===== */}
      {(recorder.state === "recording" || recorder.state === "paused") && (
        <div className="flex flex-1 flex-col items-center justify-center gap-8">
          {/* Pulsating indicator */}
          <div className="relative flex size-28 items-center justify-center">
            {recorder.state === "recording" && (
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
            )}
            <div className="relative flex size-28 items-center justify-center rounded-full bg-destructive text-white">
              <Mic className="size-10" />
            </div>
          </div>

          {/* Timer */}
          <div className="text-center">
            <p className="font-mono text-4xl font-semibold tabular-nums">
              {formatDuration(recorder.elapsed)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {recorder.state === "recording" ? "Запись..." : "Пауза"}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {recorder.state === "recording" ? (
              <Button
                variant="outline"
                size="lg"
                onClick={recorder.pause}
                className="gap-2"
              >
                <Pause className="size-4" />
                Пауза
              </Button>
            ) : (
              <Button
                variant="outline"
                size="lg"
                onClick={recorder.resume}
                className="gap-2"
              >
                <Play className="size-4" />
                Продолжить
              </Button>
            )}
            <Button
              variant="destructive"
              size="lg"
              onClick={handleRecorderStop}
              className="gap-2"
            >
              <Square className="size-4" />
              Стоп
            </Button>
          </div>
        </div>
      )}

      {/* ===== READY STATE (after recording or file upload) ===== */}
      {pageState === "ready" && currentAudioUrl && (
        <div className="flex flex-1 flex-col gap-6">
          {/* Audio player */}
          <div className="rounded-xl border bg-background p-5">
            <div className="mb-3 flex items-center gap-2">
              <FileAudio className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {audioFile?.name ?? "Запись встречи"}
              </span>
              {(recorder.elapsed > 0 || audioDuration > 0) && (
                <span className="text-xs text-muted-foreground">
                  ({formatDuration(recorder.elapsed || audioDuration)})
                </span>
              )}
            </div>
            <audio
              ref={audioPlayerRef}
              src={currentAudioUrl}
              controls
              className="w-full"
            />
          </div>

          {/* Summary level selector */}
          <div className="rounded-xl border bg-background p-5">
            <h3 className="mb-3 text-sm font-medium">Формат документа</h3>
            <div className="flex flex-col gap-2">
              {SUMMARY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                    summaryLevel === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="summaryLevel"
                    value={option.value}
                    checked={summaryLevel === option.value}
                    onChange={() => setSummaryLevel(option.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium">{option.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="size-4" />
              Сбросить
            </Button>
            <Button onClick={handleCreateDocument} className="flex-1 gap-2">
              Создать документ
            </Button>
          </div>
        </div>
      )}

      {/* ===== UPLOADING STATE ===== */}
      {pageState === "uploading" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Загрузка аудио... {uploadProgress > 0 && `${uploadProgress}%`}
          </p>
        </div>
      )}

      {/* ===== RESULT PLACEHOLDER (for Этап 3-4) ===== */}
      {pageState === "result" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="text-center">
            <span className="text-4xl">✅</span>
            <h2 className="mt-3 font-serif text-lg font-semibold">
              Аудио загружено
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Обработка будет реализована в Этапе 3
            </p>
            {blobUrl && (
              <p className="mt-2 break-all text-xs text-muted-foreground">
                {blobUrl}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={handleReset} className="mt-4 gap-2">
            <RotateCcw className="size-4" />
            Новая запись
          </Button>
        </div>
      )}
    </div>
  );
}
