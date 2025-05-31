import { useEffect, useRef, useState } from "react";

// Web Speech API type declarations
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
  interpretation: any;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionError) => any)
    | null;
  onnomatch: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface ASRHookOptions {
  onTranscriptChange: (transcript: string) => void;
  onFinalTranscript?: (transcript: string) => void;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface ASRHookReturn {
  isListening: boolean;
  isSupported: boolean;
  isRestarting: boolean;
  toggleListening: () => void;
  startListening: () => void;
  stopListening: () => void;
}

// Utility function for consistent logging
function asrLog(message: string) {
  const timestamp = new Date().toISOString().substr(11, 12); // HH:MM:SS.mmm
  console.log(`[ASR ${timestamp}] ${message}`);
}

/**
 * Custom hook for managing speech recognition
 */
export function useASR(options: ASRHookOptions): ASRHookReturn {
  const {
    onTranscriptChange,
    onFinalTranscript,
    continuous = true,
    interimResults = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const isInitializedRef = useRef(false);

  // Setup speech recognition only once
  useEffect(() => {
    if (isInitializedRef.current) return;

    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      asrLog("Speech recognition supported, initializing");
      setIsSupported(true);
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = interimResults;

      isInitializedRef.current = true;
    } else {
      asrLog("Speech recognition not supported");
    }

    return () => {
      if (recognitionRef.current) {
        asrLog("Cleaning up speech recognition on unmount");
        recognitionRef.current.stop();
      }
    };
  }, []); // Empty dependency array - only run once

  // Setup event handlers when initialized or when options change
  useEffect(() => {
    if (!recognitionRef.current || !isSupported) return;

    recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }

      asrLog(`Transcript update: "${transcript}"`);
      onTranscriptChange(transcript);

      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal && transcript.trim()) {
        asrLog(`Final transcript: "${transcript.trim()}"`);
        onFinalTranscript?.(transcript.trim());
        // Stop recognition to clear its internal state
        recognitionRef.current?.stop();
      }
    };

    recognitionRef.current.onerror = (event: SpeechRecognitionError) => {
      asrLog(`Speech recognition error: ${event.error}`);
      if (event.error === "no-speech" || event.error === "aborted") {
        asrLog("Attempting to restart after recoverable error");
        if (isListening && !isRestarting) {
          safelyRestartRecognition();
        }
      } else {
        asrLog("Non-recoverable error, stopping listening");
        setIsListening(false);
      }
    };

    recognitionRef.current.onend = () => {
      asrLog("Speech recognition ended");
      // Only restart if we are still supposed to be listening
      if (isListening && !isRestarting) {
        asrLog("Restarting speech recognition from onend");
        safelyRestartRecognition();
      }
    };
  }, [
    isListening,
    isRestarting,
    onTranscriptChange,
    onFinalTranscript,
    isSupported,
  ]);

  const safelyRestartRecognition = () => {
    if (isRestarting || !recognitionRef.current) return;

    asrLog("Starting safe restart of speech recognition");
    setIsRestarting(true);

    try {
      recognitionRef.current.stop();

      setTimeout(() => {
        try {
          if (recognitionRef.current) {
            recognitionRef.current.start();
            asrLog("Speech recognition restarted successfully");
            // Don't set isListening here, it should already be true
          }
        } catch (error) {
          asrLog(`Error starting speech recognition: ${error}`);
          setIsListening(false);
        } finally {
          setIsRestarting(false);
        }
      }, 200);
    } catch (error) {
      asrLog(`Error stopping speech recognition before restart: ${error}`);
      setIsListening(false);
      setIsRestarting(false);
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      asrLog("Cannot start - speech recognition not supported");
      return;
    }

    if (isRestarting) {
      asrLog("Cannot start while restarting recognition");
      return;
    }

    try {
      asrLog("Starting speech recognition");
      recognitionRef.current.start();
      setIsListening(true);
    } catch (error) {
      asrLog(`Error starting speech recognition: ${error}`);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    asrLog("Stopping speech recognition");
    recognitionRef.current.stop();
    setIsListening(false);
  };

  const toggleListening = () => {
    asrLog(`Toggling listening (currently ${isListening ? "on" : "off"})`);
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return {
    isListening,
    isSupported,
    isRestarting,
    toggleListening,
    startListening,
    stopListening,
  };
}
