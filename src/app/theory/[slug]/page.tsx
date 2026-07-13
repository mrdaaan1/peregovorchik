"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { getTheoryModuleBySlug } from "@/lib/theory";

function TheoryModuleContent() {
  const params = useParams<{ slug: string }>();
  const module_ = getTheoryModuleBySlug(params.slug);

  if (!module_) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-muted">Материал не найден.</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-2xl mx-auto w-full">
      <Link href="/theory" className="text-muted text-sm w-fit">
        ← Все материалы
      </Link>

      <div className="flex items-center gap-3 animate-fade-in-up">
        <span className="text-4xl">{module_.emoji}</span>
        <h1 className="font-display text-2xl font-extrabold">{module_.title}</h1>
      </div>

      <div className="flex flex-col gap-4">
        {module_.sections.map((s) => (
          <div key={s.heading} className="card-elevated rounded-2xl p-5">
            <p className="font-semibold mb-2">{s.heading}</p>
            <p className="text-sm leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-accent-soft border border-accent/20 p-5">
        <p className="font-semibold mb-2 text-accent-dark">Главное</p>
        <ul className="flex flex-col gap-2 text-sm">
          {module_.keyTakeaways.map((t) => (
            <li key={t} className="flex gap-2">
              <span className="text-accent">✓</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/dashboard"
        className="rounded-xl bg-accent hover:bg-accent-dark transition-colors text-white py-3 font-semibold text-center shadow-lg shadow-accent/20"
      >
        Применить на практике
      </Link>
    </main>
  );
}

export default function TheoryModulePage() {
  return (
    <AuthGate>
      <TheoryModuleContent />
    </AuthGate>
  );
}
