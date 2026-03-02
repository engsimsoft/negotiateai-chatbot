// ТЗ-MR Этап 4: Main meeting page with records list, result view, and new recording flow

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
  Plus,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMeetingRecorder, formatDuration } from "@/hooks/use-meeting-recorder";
import { useMeetingProcessing } from "@/hooks/use-meeting-processing";
import { MeetingProgress } from "@/components/meeting/meeting-progress";
import { MeetingResult } from "@/components/meeting/meeting-result";
import { MeetingList, type MeetingListItem } from "@/components/meeting/meeting-list";

type PageState = "input" | "ready" | "uploading" | "processing" | "result" | "viewing";
type SummaryLevel = "compact" | "standard" | "detailed";

const SUMMARY_OPTIONS: { value: SummaryLevel; label: string; description: string }[] = [
  { value: "compact", label: "Сводка", description: "Ключевые решения и задачи (~1 стр)" },
  { value: "standard", label: "Протокол", description: "Темы, решения, задачи, вопросы (~2-3 стр)" },
  { value: "detailed", label: "Детальный", description: "Полная хронология с тайм-кодами" },
];

const ACCEPTED_AUDIO_TYPES = ".mp3,.m4a,.wav,.webm,.ogg,.aac,.flac";

interface ResultRecord {
  id?: string;
  title: string;
  summary: string;
  durationSeconds: number;
  speakerCount: number;
  summaryLevel: string;
  createdAt?: string;
}

export function MeetingPage() {
  const recorder = useMeetingRecorder();
  const processing = useMeetingProcessing();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("input");
  const [summaryLevel, setSummaryLevel] = useState<SummaryLevel>("standard");
  const [userInstructions, setUserInstructions] = useState("");
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultRecord, setResultRecord] = useState<ResultRecord | null>(null);

  // Records list state
  const [records, setRecords] = useState<MeetingListItem[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [viewingRecordLoading, setViewingRecordLoading] = useState(false);

  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  // Load records list on mount
  useEffect(() => {
    fetch("/api/meeting/records")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: MeetingListItem[]) => {
        setRecords(data);
        setRecordsLoaded(true);
      })
      .catch(() => setRecordsLoaded(true));
  }, []);

  // Transition: processing complete → fetch record → show result
  useEffect(() => {
    if (processing.recordId && pageState === "processing") {
      fetch(`/api/meeting/records/${processing.recordId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setResultRecord(data);
            // Add to the local records list
            setRecords((prev) => [
              {
                id: data.id,
                title: data.title,
                durationSeconds: data.durationSeconds,
                speakerCount: data.speakerCount,
                summaryLevel: data.summaryLevel,
                createdAt: data.createdAt,
              },
              ...prev,
            ]);
          }
          setPageState("result");
        })
        .catch(() => {
          setPageState("result");
        });
    }
  }, [processing.recordId, pageState]);

  // Handle file selection
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const audio = new Audio(url);
      audio.addEventListener("loadedmetadata", () => {
        setAudioDuration(Math.round(audio.duration));
      });
    },
    [],
  );

  // Handle recorder stop → transition to ready
  const handleRecorderStop = useCallback(() => {
    recorder.stop();
    setTimeout(() => {
      setPageState("ready");
    }, 100);
  }, [recorder]);

  // Upload audio to Vercel Blob, then trigger processing
  const handleCreateDocument = useCallback(async () => {
    setError(null);

    const source = recorder.blob ?? audioFile;
    if (!source) {
      setError("Нет аудиофайла для обработки.");
      return;
    }

    try {
      setPageState("uploading");
      setUploadProgress(0);

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

      const duration = recorder.elapsed > 0 ? recorder.elapsed : audioDuration;

      setPageState("processing");
      processing.startProcessing({
        blobUrl: url,
        summaryLevel,
        durationSeconds: duration,
        userInstructions: userInstructions.trim() || null,
      });
    } catch (err) {
      console.error("[meeting] Upload error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка загрузки файла. Попробуйте ещё раз.",
      );
      setPageState("ready");
    }
  }, [recorder.blob, recorder.elapsed, audioFile, audioDuration, summaryLevel, userInstructions, processing]);

  // View an existing record from the list
  const handleSelectRecord = useCallback(async (id: string) => {
    setViewingRecordLoading(true);
    try {
      const res = await fetch(`/api/meeting/records/${id}`);
      if (!res.ok) throw new Error("Failed to load record");
      const data = await res.json();
      setResultRecord(data);
      setPageState("viewing");
    } catch {
      setError("Не удалось загрузить запись.");
    } finally {
      setViewingRecordLoading(false);
    }
  }, []);

  // Delete a record
  const handleDeleteRecord = useCallback(async () => {
    if (!resultRecord?.id) return;

    const id = resultRecord.id;
    try {
      const res = await fetch(`/api/meeting/records/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      // Remove from local list
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setResultRecord(null);
      setPageState("input");
    } catch {
      setError("Не удалось удалить запись.");
    }
  }, [resultRecord?.id]);

  // Reset to input state (new recording)
  const handleReset = useCallback(() => {
    recorder.reset();
    processing.reset();
    setPageState("input");
    setSummaryLevel("standard");
    setUserInstructions("");
    setInstructionsOpen(false);
    setAudioFile(null);
    if (audioUrl && !recorder.audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setAudioDuration(0);
    setBlobUrl(null);
    setUploadProgress(0);
    setError(null);
    setResultRecord(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [recorder, processing, audioUrl]);

  // Back to list from viewing a record
  const handleBackToInput = useCallback(() => {
    setResultRecord(null);
    setPageState("input");
    setError(null);
  }, []);

  // Current audio URL (from recorder or file — only for current session)
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

      {/* Loading overlay for record viewing */}
      {viewingRecordLoading && (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ===== INPUT STATE ===== */}
      {pageState === "input" && recorder.state === "idle" && !viewingRecordLoading && (
        <div className="flex flex-1 flex-col gap-8">
          {/* New recording section */}
          <div className="flex flex-col items-center gap-8 pt-8">
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

          {/* Records list */}
          {recordsLoaded && records.length > 0 && (
            <div className="mt-4">
              <MeetingList records={records} onSelect={handleSelectRecord} />
            </div>
          )}
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

          {/* User instructions (collapsible) */}
          <div className="rounded-xl border border-dashed bg-background p-5">
            <button
              type="button"
              onClick={() => setInstructionsOpen((prev) => !prev)}
              className="flex w-full items-center gap-2 text-sm font-medium text-foreground"
            >
              {instructionsOpen ? (
                <ChevronUp className="size-4 text-primary" />
              ) : (
                <Plus className="size-4 text-primary" />
              )}
              Добавить контекст встречи
              <span className="text-xs font-normal text-muted-foreground">
                (необязательно)
              </span>
            </button>
            {instructionsOpen && (
              <textarea
                value={userInstructions}
                onChange={(e) => setUserInstructions(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder={`Примеры:\n\n«Это собеседование на позицию маркетолога. Оцени компетенции кандидата.»\n\n«Этот отчёт для моего партнёра Алексея. Фокус на его задачах.»\n\n«Встреча с инвестором. Выжимка: прогресс, цифры, риски.»`}
                className="mt-3 w-full resize-none rounded-lg border bg-muted/30 p-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            )}
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

      {/* ===== PROCESSING STATE ===== */}
      {pageState === "processing" && (
        <MeetingProgress
          steps={processing.steps}
          isProcessing={processing.isProcessing}
          error={processing.error}
          onRetry={() => {
            if (blobUrl) {
              processing.startProcessing({
                blobUrl,
                summaryLevel,
                durationSeconds:
                  recorder.elapsed > 0 ? recorder.elapsed : audioDuration,
                userInstructions: userInstructions.trim() || null,
              });
            }
          }}
        />
      )}

      {/* ===== RESULT STATE (just processed) ===== */}
      {pageState === "result" && resultRecord && (
        <MeetingResult
          title={resultRecord.title}
          summary={resultRecord.summary}
          durationSeconds={resultRecord.durationSeconds}
          speakerCount={resultRecord.speakerCount}
          summaryLevel={resultRecord.summaryLevel}
          createdAt={resultRecord.createdAt}
          audioUrl={currentAudioUrl}
          onNewRecording={handleReset}
          onDelete={resultRecord.id ? handleDeleteRecord : undefined}
        />
      )}

      {/* ===== VIEWING STATE (loaded from history) ===== */}
      {pageState === "viewing" && resultRecord && (
        <MeetingResult
          title={resultRecord.title}
          summary={resultRecord.summary}
          durationSeconds={resultRecord.durationSeconds}
          speakerCount={resultRecord.speakerCount}
          summaryLevel={resultRecord.summaryLevel}
          createdAt={resultRecord.createdAt}
          audioUrl={null}
          onNewRecording={handleBackToInput}
          onDelete={handleDeleteRecord}
        />
      )}
    </div>
  );
}
