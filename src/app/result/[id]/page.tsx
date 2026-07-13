"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { useAuth } from "@/lib/auth-context";
import { getScenarioBySlug } from "@/lib/scenarios";
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
        <Link href="/" className="text-accent underline">
          Вернуться к сценариям
        </Link>
      </main>
    );
  }

  const outcomeInfo = OUTCOME_LABELS[result.outcome];

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center gap-4">
        <OpponentAvatar avatarKey={scenario.opponentAvatarKey} size={72} />
        <div>
          <p className="text-muted text-sm">{scenario.title}</p>
          <h1 className="text-2xl font-bold">Итоги переговоров</h1>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-6 flex items-center justify-between">
        <div>
          <p className="text-white/80 text-xs uppercase tracking-wide">Результат</p>
          <p className={`text-2xl font-extrabold`}>
            {outcomeInfo.emoji} {outcomeInfo.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-white/80 text-xs uppercase tracking-wide">Общий балл</p>
          <p className="text-4xl font-extrabold">{result.score}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-5 flex flex-col gap-4">
        <p className="font-semibold">Разбор по критериям</p>
        {result.criteria_breakdown.map((c) => (
          <div key={c.criterion}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">{c.label}</span>
              <span className="text-muted">{c.score}/100</span>
            </div>
            <div className="h-2 rounded-full bg-background overflow-hidden mb-1.5">
              <div className="h-full rounded-full bg-accent" style={{ width: `${c.score}%` }} />
            </div>
            <p className="text-muted text-sm">{c.comment}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-accent/10 border border-accent/30 p-5">
        <p className="font-semibold mb-2 text-accent">Развёрнутый разбор</p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{result.feedback_text}</p>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/scenarios/${scenario.slug}`}
          className="flex-1 rounded-xl border border-card-border bg-card py-3 font-medium text-center"
        >
          Попробовать снова
        </Link>
        <Link href="/" className="flex-1 rounded-xl bg-accent text-white py-3 font-semibold text-center">
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
