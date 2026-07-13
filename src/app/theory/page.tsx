"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { THEORY_MODULES } from "@/lib/theory";

function TheoryListContent() {
  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <div className="animate-fade-in-up">
        <Link href="/dashboard" className="text-muted text-sm w-fit">
          ← К сценариям
        </Link>
        <h1 className="font-display text-2xl font-extrabold mt-2">Теория переговоров</h1>
        <p className="text-muted text-sm mt-1">
          Краткие материалы по ключевым переговорным техникам — читай перед тренировкой или возвращайся после разбора результатов.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {THEORY_MODULES.map((m, i) => (
          <Link
            key={m.slug}
            href={`/theory/${m.slug}`}
            className="card-elevated card-elevated-interactive animate-fade-in-up rounded-2xl p-5 flex items-center gap-4"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="text-3xl">{m.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{m.title}</p>
              <p className="text-muted text-sm mt-0.5">{m.shortDescription}</p>
            </div>
            <span className="text-2xl text-muted">→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

export default function TheoryListPage() {
  return (
    <AuthGate>
      <TheoryListContent />
    </AuthGate>
  );
}
