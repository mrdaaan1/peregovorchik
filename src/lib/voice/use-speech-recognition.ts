"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API типы не входят в стандартный lib.dom.d.ts — описываем
// минимально необходимую часть интерфейса сами.
type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export type SpeechRecognitionState = "idle" | "listening" | "unsupported";

/**
 * Голосовой ввод через встроенный в браузер Web Speech API — бесплатно,
 * без сервера и без лимитов. В отличие от Telegram Mini App (WebView без
 * этого API), в обычном вебе Chrome/Edge поддерживают его нативно.
 */
export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechRecognitionState>("idle");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          onFinalRef.current?.(transcript.trim());
          setInterimText("");
        } else {
          interim += transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    recognition.onerror = () => {
      setState("idle");
    };

    recognition.onend = () => {
      setState((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback((onFinal: (text: string) => void) => {
    onFinalRef.current = onFinal;
    if (!recognitionRef.current) return;
    setInterimText("");
    recognitionRef.current.start();
    setState("listening");
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  return { state, interimText, start, stop };
}
