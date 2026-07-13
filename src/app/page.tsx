"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function LandingPage() {
  const { status } = useAuth();
  const ctaHref = status === "signed-in" ? "/dashboard" : "/login";

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <p className="text-4xl">🤝</p>
        <div>
          <h1 className="text-2xl font-bold">Арена переговоров</h1>
          <p className="text-muted text-sm mt-2">
            Тренируй деловые переговоры в диалоге с голосовым ИИ-оппонентом — на реалистичных сценариях, с оценкой результата.
          </p>
        </div>
        <Link
          href={ctaHref}
          className="w-full rounded-xl bg-accent text-white py-3 font-semibold"
        >
          {status === "signed-in" ? "К сценариям" : "Начать"}
        </Link>
      </div>
    </main>
  );
}
