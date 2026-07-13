"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar, type OpponentState } from "@/components/OpponentAvatar";
import { useAuth } from "@/lib/auth-context";
import { useSpeechRecognition } from "@/lib/voice/use-speech-recognition";
import { getScenarioBySlug } from "@/lib/scenarios";
import type { NegotiationMessage } from "@/lib/types";

type ChatMessage = { role: "user" | "opponent"; content: string };
type FlowState = "idle" | "listening" | "thinking" | "speaking" | "finishing";

function opponentStateFor(flow: FlowState): OpponentState {
  if (flow === "listening") return "listening";
  if (flow === "thinking" || flow === "finishing") return "thinking";
  if (flow === "speaking") return "talking";
  return "idle";
}

// Аудио-плеер с очередью чанков и поддержкой мгновенного прерывания
// (barge-in) — когда пользователь начинает говорить или отправляет новое
// сообщение, текущее и все ещё не сыгранные аудио должны тут же оборваться.
function useAudioQueue() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const generationRef = useRef(0);
  const onIdleRef = useRef<(() => void) | null>(null);

  function ensureAudio() {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }

  const playNext = useCallback((generation: number) => {
    if (generation !== generationRef.current) return;
    const url = queueRef.current.shift();
    if (!url) {
      playingRef.current = false;
      onIdleRef.current?.();
      return;
    }
    playingRef.current = true;
    const audio = ensureAudio();
    audio.src = url;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      playNext(generation);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      playNext(generation);
    };
    audio.play().catch(() => playNext(generation));
  }, []);

  const enqueue = useCallback(
    (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      queueRef.current.push(url);
      if (!playingRef.current) playNext(generationRef.current);
    },
    [playNext],
  );

  // Обрывает текущее воспроизведение и очищает очередь; всё, что придёт
  // после этого от уже отменённого ответа, будет проигнорировано по generation.
  const stopAll = useCallback((onIdle?: () => void) => {
    generationRef.current += 1;
    onIdleRef.current = onIdle ?? null;
    queueRef.current.splice(0).forEach((url) => URL.revokeObjectURL(url));
    playingRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
    }
  }, []);

  const currentGeneration = useCallback(() => generationRef.current, []);

  useEffect(() => stopAll, [stopAll]);

  return { enqueue, stopAll, currentGeneration };
}

// Символов в секунду для эффекта "печатает как человек" — токены от LLM
// прилетают неравномерно (иногда пачками), поэтому реальный текст копится
// в буфере, а на экран выводится с постоянной скоростью, примерно
// соответствующей темпу устной речи, а не скорости сети/генерации.
const TYPING_CHARS_PER_SEC = 18;

// Буферизует сырые дельты текста и "допечатывает" их с фиксированной
// скоростью, независимо от того, как быстро/неравномерно они приходят.
function useTypewriter(onChange: (text: string) => void) {
  const targetRef = useRef("");
  const shownRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);

  const tick = useCallback(
    (now: number) => {
      const elapsedSec = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0;
      lastTickRef.current = now;

      const target = targetRef.current;
      if (shownRef.current.length < target.length) {
        const grow = Math.max(1, Math.round(TYPING_CHARS_PER_SEC * elapsedSec));
        shownRef.current = target.slice(0, Math.min(target.length, shownRef.current.length + grow));
        onChange(shownRef.current);
      }

      if (shownRef.current.length < targetRef.current.length) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    },
    [onChange],
  );

  const ensureRunning = useCallback(() => {
    if (rafRef.current == null) {
      lastTickRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  const setTarget = useCallback(
    (text: string) => {
      targetRef.current = text;
      ensureRunning();
    },
    [ensureRunning],
  );

  const reset = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    targetRef.current = "";
    shownRef.current = "";
  }, []);

  // Мгновенно показывает весь текст целиком (например, при обрыве ответа,
  // где допечатывать по одному символу уже не имеет смысла).
  const flush = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    shownRef.current = targetRef.current;
    onChange(shownRef.current);
  }, [onChange]);

  useEffect(() => reset, [reset]);

  return { setTarget, reset, flush };
}

function SessionContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFresh = searchParams.get("fresh") === "1";
  const { supabase } = useAuth();

  const [scenarioSlug, setScenarioSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [flow, setFlow] = useState<FlowState>("idle");
  const [textInput, setTextInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;
  const abortRef = useRef<AbortController | null>(null);

  const audioQueue = useAudioQueue();
  const typewriter = useTypewriter(setStreamingText);
  const { state: micState, interimText, start: startListening, stop: stopListening } = useSpeechRecognition();

  const scenario = scenarioSlug ? getScenarioBySlug(scenarioSlug) : null;

  // Загружаем сессию и историю сообщений (на случай обновления страницы).
  useEffect(() => {
    let active = true;
    async function load() {
      const { data: session } = await supabase
        .from("sessions")
        .select("scenario_slug, status")
        .eq("id", params.id)
        .maybeSingle();

      if (!active || !session) return;
      setScenarioSlug(session.scenario_slug);

      if (session.status === "finished") {
        router.replace(`/result/${params.id}`);
        return;
      }

      const { data: history } = await supabase
        .from("messages")
        .select("role, content")
        .eq("session_id", params.id)
        .order("created_at", { ascending: true });

      if (active && history) {
        setMessages((history as NegotiationMessage[]).map((m) => ({ role: m.role, content: m.content })));
      }
    }
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamingText, flow]);

  const greetedRef = useRef(false);

  // Прерывает текущий ответ аватара (текст и аудио) — вызывается, когда
  // пользователь решает заговорить или отправить новое сообщение поверх
  // ещё звучащего ответа (barge-in).
  const interrupt = useCallback(() => {
    abortRef.current?.abort();
    audioQueue.stopAll();
    typewriter.reset();
    if (flowRef.current === "speaking" || flowRef.current === "thinking") setFlow("idle");
  }, [audioQueue, typewriter]);

  const speakOne = useCallback(
    async (text: string) => {
      if (!voiceOnRef.current) return;
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice: "male" }),
        });
        if (!res.ok) throw new Error("tts_failed");
        audioQueue.enqueue(await res.blob());
      } catch {
        // молча пропускаем — стриминговый текст уже показан пользователю
      }
    },
    [audioQueue],
  );

  // Озвучиваем заготовленную первую реплику персонажа сразу после старта
  // новой сессии — раньше она только показывалась текстом.
  useEffect(() => {
    if (!isFresh || greetedRef.current || messages.length === 0) return;
    if (messages.length === 1 && messages[0].role === "opponent") {
      greetedRef.current = true;
      setFlow("speaking");
      speakOne(messages[0].content).finally(() => {
        if (flowRef.current === "speaking") setFlow("idle");
      });
    }
  }, [isFresh, messages, speakOne]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      interrupt();
      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      typewriter.reset();
      setStreamingText("");
      setFlow("thinking");

      const controller = new AbortController();
      abortRef.current = controller;
      const generation = audioQueue.currentGeneration();

      try {
        const res = await fetch("/api/sessions/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: params.id, text: trimmed }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error("chat_failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let full = "";
        let firstDelta = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;
            const payload = JSON.parse(line.slice(5).trim());

            if (payload.type === "delta") {
              if (firstDelta) {
                firstDelta = false;
                setFlow("speaking");
              }
              full += payload.text;
              typewriter.setTarget(full);
            } else if (payload.type === "audio") {
              if (generation !== audioQueue.currentGeneration()) continue;
              const bytes = Uint8Array.from(atob(payload.audio), (c) => c.charCodeAt(0));
              audioQueue.enqueue(new Blob([bytes], { type: "audio/mpeg" }));
            } else if (payload.type === "restart") {
              // Сервер перезапустил генерацию с нуля после обрыва соединения
              // с LLM — отброшенный обрывок текста не должен остаться в UI.
              full = "";
              typewriter.reset();
              setStreamingText("");
            } else if (payload.type === "error") {
              throw new Error("chat_failed");
            }
          }
        }

        if (generation === audioQueue.currentGeneration()) {
          // Ответ уже весь получен и сохранён — дальше "допечатывать" его
          // по буквам смысла нет, поэтому сразу показываем целиком.
          typewriter.flush();
          setMessages((prev) => [...prev, { role: "opponent", content: full.trim() }]);
          setStreamingText(null);
          if (flowRef.current === "speaking") setFlow("idle");
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Не удалось получить ответ. Проверь соединение и попробуй ещё раз.");
        typewriter.reset();
        setStreamingText(null);
        setFlow("idle");
      }
    },
    [params.id, interrupt, audioQueue, typewriter],
  );

  function handleMicToggle() {
    if (micState === "listening") {
      stopListening();
      return;
    }
    // Пользователь начинает говорить поверх ответа аватара — прерываем его.
    interrupt();
    setFlow("listening");
    startListening((finalText) => {
      setFlow("idle");
      sendMessage(finalText);
    });
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = textInput;
    setTextInput("");
    sendMessage(text);
  }

  async function handleFinish() {
    interrupt();
    setFlow("finishing");
    setError(null);
    try {
      const res = await fetch("/api/sessions/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: params.id }),
      });
      if (!res.ok) throw new Error("finish_failed");
      router.push(`/result/${params.id}`);
    } catch {
      setError("Не удалось завершить сессию. Попробуй ещё раз.");
      setFlow("idle");
    }
  }

  if (!scenario) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Загрузка сессии…</p>
      </main>
    );
  }

  const busy = flow === "thinking" || flow === "finishing";

  return (
    <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-3 flex flex-col items-center border-b border-card-border">
        <div className="flex w-full items-start justify-between">
          <div className="w-10" />
          <OpponentAvatar avatarKey={scenario.opponentAvatarKey} state={opponentStateFor(flow)} size={110} />
          <button
            onClick={() => setVoiceOn((v) => !v)}
            className="w-10 h-10 rounded-full bg-card border border-card-border text-lg"
            title={voiceOn ? "Выключить озвучку" : "Включить озвучку"}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
        </div>
        <p className="font-bold mt-1">{scenario.opponentName}</p>
        <p className="text-muted text-xs">{scenario.opponentRole}</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "self-end bg-accent text-white rounded-br-md"
                : "self-start bg-card border border-card-border rounded-bl-md"
            }`}
          >
            {m.content}
          </div>
        ))}

        {streamingText !== null && (
          <div className="self-start max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap bg-card border border-card-border rounded-bl-md">
            {streamingText}
            {streamingText === "" && (
              <span className="inline-flex gap-1 align-middle">
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
              </span>
            )}
          </div>
        )}

        {micState === "listening" && interimText && (
          <div className="self-end max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-accent/40 text-white rounded-br-md italic">
            {interimText}
          </div>
        )}

        {flow === "finishing" && (
          <div className="self-start bg-card border border-card-border rounded-2xl rounded-bl-md px-4 py-3">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 flex flex-col items-center gap-3">
        {micState === "unsupported" ? (
          <p className="text-muted text-xs text-center">
            Голосовой ввод не поддерживается этим браузером — используй Chrome или Edge, либо пиши текстом ниже.
          </p>
        ) : (
          <button
            onClick={handleMicToggle}
            disabled={flow === "finishing"}
            aria-label={micState === "listening" ? "Остановить запись" : "Начать говорить"}
            className={`w-20 h-20 rounded-full text-3xl shadow-lg transition-all disabled:opacity-40 ${
              micState === "listening"
                ? "bg-red-500 text-white scale-110 animate-pulse"
                : "bg-gradient-to-br from-accent to-accent-dark text-white active:scale-95"
            }`}
          >
            {micState === "listening" ? "⏹" : "🎤"}
          </button>
        )}

        <form onSubmit={handleTextSubmit} className="w-full flex gap-2">
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Или напиши текстом…"
            className="flex-1 rounded-xl bg-card border border-card-border px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={flow === "finishing" || !textInput.trim()}
            className="rounded-xl bg-accent text-white px-4 font-semibold disabled:opacity-40"
          >
            ➤
          </button>
        </form>

        <button
          onClick={handleFinish}
          disabled={busy || messages.length < 2}
          className="text-muted text-sm underline disabled:opacity-40"
        >
          Завершить переговоры и получить оценку
        </button>
      </div>
    </main>
  );
}

export default function SessionPage() {
  return (
    <AuthGate>
      <Suspense fallback={null}>
        <SessionContent />
      </Suspense>
    </AuthGate>
  );
}
