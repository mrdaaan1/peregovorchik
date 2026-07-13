"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

function SessionContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { supabase } = useAuth();

  const [scenarioSlug, setScenarioSlug] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [flow, setFlow] = useState<FlowState>("idle");
  const [textInput, setTextInput] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;

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
  }, [messages, flow]);

  const speak = useCallback(async (text: string) => {
    if (!voiceOn) return;
    setFlow("speaking");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "male" }),
      });
      if (!res.ok) throw new Error("tts_failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.src = url;
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } catch {
      await new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;
        if (!synth) return resolve();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ru-RU";
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    } finally {
      if (flowRef.current === "speaking") setFlow("idle");
    }
  }, [voiceOn]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);
      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setFlow("thinking");

      try {
        const res = await fetch("/api/sessions/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: params.id, text: trimmed }),
        });
        if (!res.ok) throw new Error("chat_failed");
        const { reply } = (await res.json()) as { reply: string };

        setMessages((prev) => [...prev, { role: "opponent", content: reply }]);
        await speak(reply);
        if (flowRef.current !== "speaking") setFlow("idle");
      } catch {
        setError("Не удалось получить ответ. Проверь соединение и попробуй ещё раз.");
        setFlow("idle");
      }
    },
    [params.id, speak],
  );

  function handleMicToggle() {
    if (micState === "listening") {
      stopListening();
      return;
    }
    setFlow("listening");
    startListening((finalText) => {
      stopListening();
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

        {micState === "listening" && interimText && (
          <div className="self-end max-w-[85%] rounded-2xl px-4 py-2.5 text-sm bg-accent/40 text-white rounded-br-md italic">
            {interimText}
          </div>
        )}

        {busy && (
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
            disabled={busy}
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
            disabled={busy || !textInput.trim()}
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
      <SessionContent />
    </AuthGate>
  );
}
