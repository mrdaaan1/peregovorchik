"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { OpponentAvatar } from "@/components/OpponentAvatar";
import { useAuth } from "@/lib/auth-context";
import { SCENARIOS, type Difficulty } from "@/lib/scenarios";

const DIFFICULTY_LABELS: Record<Difficulty, { label: string; color: string }> = {
  easy: { label: "Лёгкий", color: "text-emerald-600" },
  medium: { label: "Средний", color: "text-amber-600" },
  hard: { label: "Сложный", color: "text-red-600" },
};

function DashboardContent() {
  const { profile, supabase } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🤝 Арена переговоров</h1>
          <p className="text-muted text-sm mt-1">
            {profile?.display_name ?? profile?.email} — выбери сценарий и начни тренировку
          </p>
        </div>
        <button onClick={handleSignOut} className="text-muted text-sm underline shrink-0">
          Выйти
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {SCENARIOS.map((scenario) => (
          <Link
            key={scenario.slug}
            href={`/scenarios/${scenario.slug}`}
            className="rounded-2xl bg-card border border-card-border p-5 flex items-center gap-4 hover:border-accent transition-colors"
          >
            <OpponentAvatar avatarKey={scenario.opponentAvatarKey} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">{scenario.title}</p>
                <span className={`text-xs font-medium ${DIFFICULTY_LABELS[scenario.difficulty].color}`}>
                  {DIFFICULTY_LABELS[scenario.difficulty].label}
                </span>
              </div>
              <p className="text-muted text-sm mt-0.5">{scenario.shortDescription}</p>
            </div>
            <span className="text-2xl text-muted">→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
