"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { useAuth } from "@/lib/auth-context";
import { SCENARIOS, getScenarioBySlug, type Difficulty } from "@/lib/scenarios";
import { ACHIEVEMENTS, computeUnlockedAchievements, type SessionWithResult } from "@/lib/achievements";
import type { NegotiationSession, SessionResult } from "@/lib/types";

const DIFFICULTY_LABELS: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: "Лёгкий", color: "text-emerald-600" },
  medium: { label: "Средний", color: "text-amber-600" },
  hard: { label: "Сложный", color: "text-red-600" },
};

function nextRecommendedScenario(history: SessionWithResult[]): (typeof SCENARIOS)[number] {
  const finishedSlugs = new Set(
    history.filter((h) => h.session.status === "finished").map((h) => h.session.scenario_slug),
  );
  const notYetTried = SCENARIOS.find((s) => !finishedSlugs.has(s.slug));
  if (notYetTried) return notYetTried;

  // Всё уже пробовал — рекомендуем сценарий с самым низким последним баллом,
  // чтобы roadmap указывал на реальную зону роста, а не просто на новизну.
  const bySlug = new Map<string, number>();
  history.forEach((h) => {
    if (h.result) bySlug.set(h.session.scenario_slug, h.result.score);
  });
  let worst = SCENARIOS[0];
  let worstScore = 101;
  for (const s of SCENARIOS) {
    const score = bySlug.get(s.slug) ?? 0;
    if (score < worstScore) {
      worstScore = score;
      worst = s;
    }
  }
  return worst;
}

function DashboardContent() {
  const { profile, supabase } = useAuth();
  const [history, setHistory] = useState<SessionWithResult[] | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profile) return;
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, scenario_slug, status")
        .eq("user_id", profile.id)
        .order("started_at", { ascending: false });

      if (!sessions || sessions.length === 0) {
        if (active) setHistory([]);
        return;
      }

      const { data: results } = await supabase
        .from("session_results")
        .select("session_id, outcome, score, criteria_breakdown")
        .in(
          "session_id",
          sessions.map((s) => s.id),
        );

      const resultBySession = new Map((results ?? []).map((r) => [r.session_id, r]));
      if (active) {
        setHistory(
          sessions.map((s) => ({
            session: { scenario_slug: s.scenario_slug, status: s.status } as Pick<
              NegotiationSession,
              "scenario_slug" | "status"
            >,
            result: (resultBySession.get(s.id) as SessionResult | undefined) ?? null,
          })),
        );
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [profile, supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const finished = (history ?? []).filter((h) => h.session.status === "finished" && h.result);
  const sessionsCompleted = finished.length;
  const avgScore =
    sessionsCompleted > 0 ? Math.round(finished.reduce((sum, h) => sum + h.result!.score, 0) / sessionsCompleted) : 0;
  const wins = finished.filter((h) => h.result!.outcome === "win").length;

  const unlocked = history
    ? computeUnlockedAchievements(history, (slug) => getScenarioBySlug(slug)?.difficulty)
    : new Set<string>();

  const recommended = history && history.length > 0 ? nextRecommendedScenario(history) : SCENARIOS[0];

  return (
    <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-extrabold">🤝 Арена переговоров</h1>
          <p className="text-muted text-sm mt-1">{profile?.display_name ?? profile?.email}</p>
        </div>
        <button onClick={handleSignOut} className="text-muted text-sm underline shrink-0">
          Выйти
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_20rem] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {history && (
            <Link
              href={`/scenarios/${recommended.slug}`}
              className="card-elevated card-elevated-interactive rounded-2xl bg-gradient-to-br from-gold/15 to-transparent p-5 flex items-center gap-4 animate-fade-in-up"
              style={{ borderColor: "color-mix(in srgb, var(--gold) 35%, var(--card-border))" }}
            >
              <span className="text-3xl">🗺️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wide text-gold-dark font-semibold">
                  {history.length === 0 ? "С чего начать" : "Следующий шаг"}
                </p>
                <p className="font-semibold mt-0.5">{recommended.title}</p>
                <p className="text-muted text-sm mt-0.5">{recommended.shortDescription}</p>
              </div>
              <span className="text-2xl text-muted">→</span>
            </Link>
          )}

          <Link
            href="/theory"
            className="card-elevated card-elevated-interactive rounded-2xl p-4 flex items-center gap-3"
          >
            <span className="text-2xl">🎓</span>
            <span className="font-medium text-sm">Теория переговоров</span>
          </Link>

          <div>
            <p className="font-semibold mb-3">Сценарии</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {SCENARIOS.map((scenario, i) => (
                <Link
                  key={scenario.slug}
                  href={`/scenarios/${scenario.slug}`}
                  className="card-elevated card-elevated-interactive animate-fade-in-up rounded-2xl p-5 flex items-center gap-4"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <OpponentAvatar avatarKey={scenario.opponentAvatarKey} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{scenario.title}</p>
                      <span className={`text-xs font-medium shrink-0 ${DIFFICULTY_LABELS[scenario.difficulty].color}`}>
                        {DIFFICULTY_LABELS[scenario.difficulty].label}
                      </span>
                    </div>
                    <p className="text-muted text-sm mt-0.5">{scenario.shortDescription}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-8">
          {history && history.length > 0 && (
            <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 animate-fade-in-up">
              <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-4 text-center lg:flex lg:items-center lg:justify-between lg:text-left shadow-lg shadow-accent/20">
                <p className="font-display text-2xl font-extrabold tabular-nums">{sessionsCompleted}</p>
                <p className="text-xs text-white/80 mt-0.5 lg:mt-0">тренировок</p>
              </div>
              <div className="card-elevated rounded-2xl p-4 text-center lg:flex lg:items-center lg:justify-between lg:text-left">
                <p className="font-display text-2xl font-extrabold tabular-nums">{avgScore}</p>
                <p className="text-muted text-xs mt-0.5 lg:mt-0">средний балл</p>
              </div>
              <div className="card-elevated rounded-2xl p-4 text-center lg:flex lg:items-center lg:justify-between lg:text-left">
                <p className="font-display text-2xl font-extrabold tabular-nums">
                  {wins}
                  <span className="text-base">🏆</span>
                </p>
                <p className="text-muted text-xs mt-0.5 lg:mt-0">побед</p>
              </div>
            </div>
          )}

          <div>
            <p className="font-semibold mb-3">Достижения</p>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              {ACHIEVEMENTS.map((a) => {
                const isUnlocked = unlocked.has(a.key);
                return (
                  <div
                    key={a.key}
                    className={`rounded-2xl border p-4 flex flex-col lg:flex-row items-center text-center lg:text-left gap-1 lg:gap-3 transition-all ${
                      isUnlocked ? "card-elevated" : "bg-card/40 border-card-border opacity-40 grayscale"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{isUnlocked ? a.emoji : "🔒"}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{a.title}</p>
                      <p className="text-muted text-xs">{a.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
