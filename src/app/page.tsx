"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

const HIGHLIGHTS = [
  { emoji: "🎙️", text: "Живой голосовой диалог с ИИ-оппонентом, а не текстовый квиз" },
  { emoji: "🎭", text: "6 сценариев — от аренды квартиры до жёстких переговоров с инвестором" },
  { emoji: "🎓", text: "Теория Гарвардского метода, SPIN и BATNA — встроена прямо в тренировку" },
  { emoji: "📊", text: "Разбор по репликам после каждой сессии и рекомендации, что почитать" },
];

export default function LandingPage() {
  const { status } = useAuth();
  const ctaHref = status === "signed-in" ? "/dashboard" : "/login";

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-14">
      <div className="w-full max-w-md flex flex-col items-center gap-8 text-center animate-fade-in-up">
        <span className="text-5xl">🤝</span>

        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold leading-tight">
            Арена переговоров
          </h1>
          <p className="text-muted text-base mt-3 leading-relaxed">
            Тренируй деловые переговоры голосом против ИИ-оппонента — на реалистичных сценариях,
            с разбором и оценкой результата.
          </p>
        </div>

        <Link
          href={ctaHref}
          className="w-full rounded-xl bg-accent hover:bg-accent-dark transition-colors text-white py-3.5 font-semibold shadow-lg shadow-accent/25"
        >
          {status === "signed-in" ? "К сценариям" : "Начать бесплатно"}
        </Link>

        <ul className="w-full flex flex-col gap-3 text-left">
          {HIGHLIGHTS.map((h) => (
            <li key={h.text} className="card-elevated rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-xl shrink-0">{h.emoji}</span>
              <span className="text-sm">{h.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
