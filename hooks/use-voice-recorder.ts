"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type VoiceState,
  type VoiceError,
  type VoiceRecorderOptions,
  type VoiceRecorderReturn,
  type DeepgramMessage,
  SAMPLE_RATE,
  DEEPGRAM_WS_URL,
  DEEPGRAM_PARAMS,
  TOKEN_ENDPOINT,
  MAX_RECORDING_DURATION,
  floatTo16BitPCM,
  resampleAudio,
  createVoiceError,
  checkBrowserSupport,
} from "@/lib/audio";

export function useVoiceRecorder(
  options: VoiceRecorderOptions = {}
): VoiceRecorderReturn {
  const { onTranscript, onInterimTranscript, onError, onStateChange } = options;

  // State
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);

  // Refs for cleanup
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ТЗ-BILLING1: track recording start time for cost logging
  const recordingStartRef = useRef<number>(0);

  // Check availability on mount
  useEffect(() => {
    const checkAvailability = async () => {
      if (!checkBrowserSupport()) {
        setIsAvailable(false);
        return;
      }

      try {
        const response = await fetch(TOKEN_ENDPOINT);
        if (response.ok) {
          const data = await response.json();
          setIsAvailable(data.available === true);
        }
      } catch {
        setIsAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  // Update state and notify
  const updateState = useCallback(
    (newState: VoiceState) => {
      setState(newState);
      onStateChange?.(newState);
    },
    [onStateChange]
  );

  // Handle error
  const handleError = useCallback(
    (voiceError: VoiceError) => {
      setError(voiceError);
      updateState("error");
      onError?.(voiceError);
    },
    [onError, updateState]
  );

  // Cleanup function
  const cleanup = useCallback(() => {
    // Clear max duration timer
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    // ТЗ-BILLING1: log Deepgram usage (fire-and-forget)
    if (recordingStartRef.current > 0) {
      const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
      recordingStartRef.current = 0;
      if (durationSeconds >= 0.5) {
        fetch("/api/deepgram/usage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationSeconds }),
        }).catch(() => {
          // Fire-and-forget — don't break UX if logging fails
        });
      }
    }
    cleanup();
    updateState("idle");
    setInterimTranscript("");
  }, [cleanup, updateState]);

  // Start recording
  const startRecording = useCallback(async () => {
    // Reset state
    setError(null);
    setTranscript("");
    setInterimTranscript("");

    // Check browser support
    if (!checkBrowserSupport()) {
      handleError(createVoiceError("browser_unsupported"));
      return;
    }

    try {
      updateState("processing");

      // Get API key from server
      const tokenResponse = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      if (!tokenResponse.ok) {
        handleError(createVoiceError("api_error"));
        return;
      }
      const tokenData = await tokenResponse.json();
      const { apiKey } = tokenData;

      // Request microphone access
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: SAMPLE_RATE,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (err) {
        if (err instanceof Error) {
          if (
            err.name === "NotAllowedError" ||
            err.name === "PermissionDeniedError"
          ) {
            handleError(createVoiceError("permission_denied", err));
          } else if (
            err.name === "NotFoundError" ||
            err.name === "DevicesNotFoundError"
          ) {
            handleError(createVoiceError("no_microphone", err));
          } else {
            handleError(createVoiceError("unknown", err));
          }
        }
        return;
      }
      streamRef.current = stream;

      // Create audio context
      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      audioContextRef.current = audioContext;

      // Create WebSocket connection to Deepgram
      const wsParams = new URLSearchParams(DEEPGRAM_PARAMS);
      const wsUrl = `${DEEPGRAM_WS_URL}?${wsParams.toString()}`;
      // Deepgram auth via WebSocket subprotocol
      const ws = new WebSocket(wsUrl, ["token", apiKey]);
      wsRef.current = ws;

      ws.onopen = () => {
        updateState("recording");
        // ТЗ-BILLING1: mark recording start for duration calculation
        recordingStartRef.current = Date.now();

        // Start max duration timer (auto-stop after 3 minutes)
        maxDurationTimerRef.current = setTimeout(() => {
          stopRecording();
        }, MAX_RECORDING_DURATION);

        // Set up audio processing
        const source = audioContext.createMediaStreamSource(stream);

        // Use ScriptProcessorNode (deprecated but widely supported)
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);

          // Resample if needed
          const resampled = resampleAudio(
            inputData,
            audioContext.sampleRate,
            SAMPLE_RATE
          );

          // Convert to 16-bit PCM
          const pcm = floatTo16BitPCM(resampled);

          // Send raw binary data (ArrayBuffer)
          ws.send(pcm.buffer);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = (event) => {
        try {
          const message: DeepgramMessage = JSON.parse(event.data);

          if (message.type === "Results") {
            const transcriptText =
              message.channel?.alternatives?.[0]?.transcript || "";

            if (message.is_final && transcriptText) {
              // Final result - add to transcript
              onTranscript?.(transcriptText);
              setTranscript((prev) =>
                prev ? `${prev} ${transcriptText}` : transcriptText
              );
              setInterimTranscript("");
            } else if (transcriptText) {
              // Interim result - show while speaking
              setInterimTranscript(transcriptText);
              onInterimTranscript?.(transcriptText);
            }
            // Без автостопа — запись продолжается до ручного нажатия кнопки
            // Пользователь может думать, делать паузы, мычать
          } else if (message.type === "Error") {
            handleError(createVoiceError("api_error"));
            cleanup();
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        handleError(createVoiceError("network_error"));
        cleanup();
      };

      ws.onclose = () => {
        if (state === "recording") {
          updateState("idle");
        }
      };
    } catch (err) {
      handleError(
        createVoiceError("unknown", err instanceof Error ? err : undefined)
      );
      cleanup();
    }
  }, [
    handleError,
    updateState,
    cleanup,
    stopRecording,
    onTranscript,
    onInterimTranscript,
    state,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    isRecording: state === "recording",
    isProcessing: state === "processing",
    transcript,
    interimTranscript,
    error,
    startRecording,
    stopRecording,
    isAvailable,
  };
}
