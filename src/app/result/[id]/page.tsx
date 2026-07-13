"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { useAuth } from "@/lib/auth-context";
import { getScenarioBySlug } from "@/lib/scenarios";
import { recommendBooks } from "@/lib/books";
import type { SessionResult } from "@/lib/types";

const OUTCOME_LABELS: Record<SessionResult["outcome"], { label: string; emoji: string; color: string }> = {
  win: { label: "Успех", emoji: "🏆", color: "text-emerald-600" },
  draw: { label: "Компромисс", emoji: "🤝", color: "text-amber-600" },
  lose: { label: "Провал", emoji: "📉", color: "text-red-600" },
};

function ResultContent() {
  const params = useParams<{ id: string }>();
  const { supabase } = useAuth();
  const [result, setResult] = useState<SessionResult | null>(null);
  const [scenarioSlug, setScenarioSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const [{ data: session }, { data: existingResult }] = await Promise.all([
        supabase.from("sessions").select("scenario_slug").eq("id", params.id).maybeSingle(),
        supabase.from("session_results").select("*").eq("session_id", params.id).maybeSingle(),
      ]);

      if (!active) return;
      if (session) setScenarioSlug(session.scenario_slug);

      if (existingResult) {
        setResult(existingResult as SessionResult);
        setLoading(false);
        return;
      }

      // Результата ещё нет — сессия могла быть не завершена штатно (например,
      // пользователь ушёл со страницы до ответа /finish). Пробуем завершить сейчас.
      const res = await fetch("/api/sessions/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: params.id }),
      });
      if (active && res.ok) {
        const { result: freshResult } = await res.json();
        setResult(freshResult as SessionResult);
      }
      if (active) setLoading(false);
    }
    load();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const scenario = scenarioSlug ? getScenarioBySlug(scenarioSlug) : null;

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Анализируем переговоры…</p>
      </main>
    );
  }

  if (!result || !scenario) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-muted text-center">
          Не удалось получить результат — возможно, диалог был слишком коротким.
        </p>
        <Link href="/dashboard" className="text-accent underline">
          Вернуться к сценариям
        </Link>
      </main>
    );
  }

  const outcomeInfo = OUTCOME_LABELS[result.outcome];
  const weakCriteria = result.criteria_breakdown.filter((c) => c.score < 70).map((c) => c.criterion);
  const books = recommendBooks(weakCriteria);

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-4 animate-fade-in-up">
        <OpponentAvatar avatarKey={scenario.opponentAvatarKey} size={72} />
        <div>
          <p className="text-muted text-sm">{scenario.title}</p>
          <h1 className="font-display text-2xl font-extrabold">Итоги переговоров</h1>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-6 flex items-center justify-between shadow-xl shadow-accent/25 animate-scale-in">
        <div>
          <p className="text-white/80 text-xs uppercase tracking-wide">Результат</p>
          <p className="font-display text-2xl font-extrabold mt-0.5">
            {outcomeInfo.emoji} {outcomeInfo.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/80 text-xs uppercase tracking-wide">Общий балл</p>
          <p className="font-display text-4xl font-extrabold tabular-nums">{result.score}</p>
        </div>
      </div>

      <div className="card-elevated rounded-2xl p-5 flex flex-col gap-4">
        <p className="font-semibold">Разбор по критериям</p>
        {result.criteria_breakdown.map((c) => (
          <div key={c.criterion}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted tabular-nums">{c.score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-background overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-dark transition-all duration-700"
                style={{ width: `${c.score}%` }}
              />
            </div>
            <p className="text-muted text-sm">{c.comment}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-accent-soft border border-accent/20 p-5">
        <p className="font-semibold mb-2 text-accent-dark">Развёрнутый разбор</p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{result.feedback_text}</p>
      </div>

      {result.key_moments && result.key_moments.length > 0 && (
        <div className="card-elevated rounded-2xl p-5 flex flex-col gap-3">
          <p className="font-semibold">Ключевые моменты диалога</p>
          {result.key_moments.map((m, i) => (
            <div
              key={i}
              className={`rounded-r-lg border-l-4 pl-4 py-2 ${
                m.verdict === "good" ? "border-emerald-500 bg-emerald-500/5" : "border-danger bg-danger/5"
              }`}
            >
              <p className="text-sm italic">«{m.quote}»</p>
              <p className="text-muted text-sm mt-1">
                {m.verdict === "good" ? "✅ " : "⚠️ "}
                {m.comment}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="card-elevated rounded-2xl p-5">
        <p className="font-semibold mb-1">📚 Что почитать дальше</p>
        <p className="text-muted text-sm mb-3">Подобрано под то, что стоит прокачать в этом сценарии</p>
        <div className="flex flex-col gap-3">
          {books.map((b) => (
            <div key={b.title} className="flex gap-3">
              <span className="text-2xl">{b.emoji}</span>
              <div>
                <p className="font-medium text-sm">
                  {b.title} <span className="text-muted font-normal">— {b.author}</span>
                </p>
                <p className="text-muted text-sm mt-0.5">{b.pitch}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/scenarios/${scenario.slug}`}
          className="card-elevated card-elevated-interactive flex-1 rounded-xl py-3 font-medium text-center"
        >
          Попробовать снова
        </Link>
        <Link
          href="/dashboard"
          className="flex-1 rounded-xl bg-accent hover:bg-accent-dark transition-colors text-white py-3 font-semibold text-center"
        >
          К сценариям
        </Link>
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <AuthGate>
      <ResultContent />
    </AuthGate>
  );
}
