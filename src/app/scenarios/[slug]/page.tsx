"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { getScenarioBySlug } from "@/lib/scenarios";
import { getTheoryModulesForScenario } from "@/lib/theory";

function ScenarioBriefingContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = getScenarioBySlug(params.slug);
  const relevantTheory = scenario ? getTheoryModulesForScenario(scenario.slug) : [];

  if (!scenario) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-muted">Сценарий не найден.</p>
      </main>
    );
  }

  async function handleStart() {
    setStarting(true);
    setError(null);

    const res = await fetch("/api/sessions/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenarioSlug: scenario!.slug }),
    });

    if (!res.ok) {
      setError("Не удалось начать сессию. Попробуй ещё раз.");
      setStarting(false);
      return;
    }

    const { sessionId } = await res.json();
    router.push(`/session/${sessionId}?fresh=1`);
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <Link href="/dashboard" className="text-muted text-sm w-fit">
        ← Назад к сценариям
      </Link>

      <div className="flex items-center gap-4 animate-fade-in-up">
        <OpponentAvatar avatarKey={scenario.opponentAvatarKey} size={88} />
        <div>
          <h1 className="font-display text-2xl font-extrabold">{scenario.title}</h1>
          <p className="text-muted text-sm mt-0.5">
            Оппонент: {scenario.opponentName} ({scenario.opponentRole})
          </p>
        </div>
      </div>

      {scenario.contentWarning && (
        <div className="rounded-2xl bg-danger/10 border border-danger/30 p-5">
          <p className="font-semibold mb-1 text-danger">⚠️ Предупреждение</p>
          <p className="text-sm leading-relaxed">{scenario.contentWarning}</p>
        </div>
      )}

      <div className="card-elevated rounded-2xl p-5">
        <p className="font-semibold mb-2">Твоя роль и ситуация</p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{scenario.briefingText}</p>
      </div>

      <div className="rounded-2xl bg-accent-soft border border-accent/20 p-5">
        <p className="font-semibold mb-2 text-accent-dark">Что оценивается</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {scenario.evaluationCriteria.map((c) => (
            <li key={c.key} className="flex justify-between gap-3">
              <span>{c.label}</span>
              <span className="text-muted tabular-nums">{c.weight}%</span>
            </li>
          ))}
        </ul>
      </div>

      {relevantTheory.length > 0 && (
        <div className="card-elevated rounded-2xl p-5">
          <p className="font-semibold mb-3">Пригодится перед стартом</p>
          <div className="flex flex-col gap-2">
            {relevantTheory.map((t) => (
              <Link
                key={t.slug}
                href={`/theory/${t.slug}`}
                className="flex items-center gap-2 text-sm hover:text-accent transition-colors"
              >
                <span>{t.emoji}</span>
                <span className="underline">{t.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={starting}
        className="rounded-xl bg-accent hover:bg-accent-dark transition-colors text-white py-3.5 font-semibold text-lg disabled:opacity-50 shadow-lg shadow-accent/20"
      >
        {starting ? "Готовим сессию…" : "Начать переговоры"}
      </button>

      {error && <p className="text-danger text-sm text-center">{error}</p>}
    </main>
  );
}

export default function ScenarioBriefingPage() {
  return (
    <AuthGate>
      <ScenarioBriefingContent />
    </AuthGate>
  );
}
