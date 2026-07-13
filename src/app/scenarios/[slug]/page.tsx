"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { getScenarioBySlug } from "@/lib/scenarios";

function ScenarioBriefingContent() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = getScenarioBySlug(params.slug);

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
    router.push(`/session/${sessionId}`);
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <Link href="/" className="text-muted text-sm w-fit">
        ← Назад к сценариям
      </Link>

      <div className="flex items-center gap-4">
        <OpponentAvatar avatarKey={scenario.opponentAvatarKey} size={88} />
        <div>
          <h1 className="text-2xl font-bold">{scenario.title}</h1>
          <p className="text-muted text-sm mt-0.5">
            Оппонент: {scenario.opponentName} ({scenario.opponentRole})
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-5">
        <p className="font-semibold mb-2">Твоя роль и ситуация</p>
        <p className="text-sm leading-relaxed whitespace-pre-line">{scenario.briefingText}</p>
      </div>

      <div className="rounded-2xl bg-accent/10 border border-accent/30 p-5">
        <p className="font-semibold mb-2 text-accent">Что оценивается</p>
        <ul className="flex flex-col gap-1.5 text-sm">
          {scenario.evaluationCriteria.map((c) => (
            <li key={c.key} className="flex justify-between gap-3">
              <span>{c.label}</span>
              <span className="text-muted">{c.weight}%</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        onClick={handleStart}
        disabled={starting}
        className="rounded-xl bg-accent text-white py-3.5 font-semibold text-lg disabled:opacity-50"
      >
        {starting ? "Готовим сессию…" : "Начать переговоры"}
      </button>

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}
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
