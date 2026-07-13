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
 *
 * Браузер сам обрывает `continuous`-сессию после паузы в речи (событие
 * `onend`), даже если мы не считаем фразу законченной. Пользователь может
 * молчать, обдумывая следующую реплику, поэтому запись должна идти до тех
 * пор, пока он сам не нажмёт кнопку повторно — поэтому при "тихом" onend
 * (не по явной команде stop()) распознавание автоматически перезапускается,
 * а накопленный текст не отправляется по промежуточным isFinal-событиям.
 */
export function useSpeechRecognition() {
  const [state, setState] = useState<SpeechRecognitionState>("idle");
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef<((text: string) => void) | null>(null);
  const stoppedByUserRef = useRef(true);
  const finalChunksRef = useRef<string[]>([]);

  useEffect(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    function createRecognition() {
      const recognition = new Ctor!();
      recognition.lang = "ru-RU";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) {
            finalChunksRef.current.push(transcript.trim());
          } else {
            interim += transcript;
          }
        }
        setInterimText([...finalChunksRef.current, interim].filter(Boolean).join(" "));
      };

      recognition.onerror = () => {
        setState("idle");
      };

      recognition.onend = () => {
        if (stoppedByUserRef.current) {
          setState((prev) => (prev === "listening" ? "idle" : prev));
          return;
        }
        // Браузер завершил сессию сам (пауза в речи) — пользователь ещё не
        // нажимал стоп, поэтому просто продолжаем слушать дальше.
        recognition.start();
      };

      return recognition;
    }

    recognitionRef.current = createRecognition();

    return () => {
      stoppedByUserRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const start = useCallback((onFinal: (text: string) => void) => {
    onFinalRef.current = onFinal;
    if (!recognitionRef.current) return;
    finalChunksRef.current = [];
    setInterimText("");
    stoppedByUserRef.current = false;
    recognitionRef.current.start();
    setState("listening");
  }, []);

  const stop = useCallback(() => {
    stoppedByUserRef.current = true;
    recognitionRef.current?.stop();
    setState("idle");
    setInterimText((current) => {
      if (current) onFinalRef.current?.(current);
      return "";
    });
    finalChunksRef.current = [];
  }, []);

  return { state, interimText, start, stop };
}
