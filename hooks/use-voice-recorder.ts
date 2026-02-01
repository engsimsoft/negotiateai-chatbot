"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type VoiceState,
  type VoiceError,
  type VoiceRecorderOptions,
  type VoiceRecorderReturn,
  type AssemblyAIMessage,
  SAMPLE_RATE,
  ASSEMBLYAI_WS_URL,
  TOKEN_ENDPOINT,
  floatTo16BitPCM,
  int16ToBase64,
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

      // Get token from server
      const tokenResponse = await fetch(TOKEN_ENDPOINT, { method: "POST" });
      if (!tokenResponse.ok) {
        handleError(createVoiceError("api_error"));
        return;
      }
      const { token } = await tokenResponse.json();

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

      // Create WebSocket connection
      const wsUrl = `${ASSEMBLYAI_WS_URL}?sample_rate=${SAMPLE_RATE}&token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        updateState("recording");

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

          // Convert to 16-bit PCM and base64
          const pcm = floatTo16BitPCM(resampled);
          const base64 = int16ToBase64(pcm);

          // Send to AssemblyAI
          ws.send(JSON.stringify({ audio_data: base64 }));
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = (event) => {
        try {
          const message: AssemblyAIMessage = JSON.parse(event.data);

          if (message.message_type === "FinalTranscript" && message.transcript) {
            const text = message.transcript.trim();
            if (text) {
              setTranscript((prev) => {
                const newTranscript = prev ? `${prev} ${text}` : text;
                onTranscript?.(newTranscript);
                return newTranscript;
              });
              setInterimTranscript("");
            }

            // Auto-stop on end of turn
            if (message.end_of_turn) {
              stopRecording();
            }
          } else if (
            message.message_type === "PartialTranscript" &&
            message.transcript
          ) {
            const text = message.transcript.trim();
            setInterimTranscript(text);
            onInterimTranscript?.(text);
          } else if (message.message_type === "Error") {
            handleError(
              createVoiceError("api_error", new Error(message.error || "Unknown error"))
            );
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
