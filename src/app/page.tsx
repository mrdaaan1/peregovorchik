"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { OpponentAvatar } from "@/components/OpponentAvatar";

const HIGHLIGHTS = [
  {
    emoji: "🎙️",
    title: "Живой голосовой диалог",
    text: "Говоришь голосом, оппонент отвечает голосом в реальном времени — а не текстовый квиз с вариантами ответа.",
  },
  {
    emoji: "🎭",
    title: "6 непохожих сценариев",
    text: "От бытового торга за аренду квартиры до жёстких переговоров с инвестором, который может нагрубить в ответ.",
  },
  {
    emoji: "🎓",
    title: "Теория прямо в тренировке",
    text: "Гарвардский метод, SPIN и BATNA — с разбором реальных сцен переговоров из кино перед каждым сценарием.",
  },
  {
    emoji: "📊",
    title: "Разбор по репликам",
    text: "После сессии — что сработало, что нет, с цитатами из твоего диалога и рекомендацией книги под слабое место.",
  },
  {
    emoji: "🗺️",
    title: "Дорожная карта прогресса",
    text: "Достижения и подсказка следующего шага — дашборд показывает, где ты сейчас и что тренировать дальше.",
  },
  {
    emoji: "🔥",
    title: "Ставки на реальность",
    text: "Оппонент помнит весь диалог, уступает только под давлением весомых аргументов и оценивает итог как независимый эксперт.",
  },
];

export default function LandingPage() {
  const { status } = useAuth();
  const ctaHref = status === "signed-in" ? "/dashboard" : "/login";

  return (
    <main className="flex-1 px-4 py-14 lg:py-20">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-16">
        {/* Hero: узкая колонка на мобильном, двухколоночная композиция на десктопе */}
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center animate-fade-in-up">
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-6">
            <span className="text-5xl">🤝</span>
            <div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight">
                Арена переговоров
              </h1>
              <p className="text-muted text-base lg:text-lg mt-4 leading-relaxed max-w-md">
                Тренируй деловые переговоры голосом против ИИ-оппонента — на реалистичных
                сценариях, с теорией, разбором и оценкой результата после каждой сессии.
              </p>
            </div>
            <Link
              href={ctaHref}
              className="w-full sm:w-auto rounded-xl bg-accent hover:bg-accent-dark transition-colors text-white px-8 py-3.5 font-semibold shadow-lg shadow-accent/25 text-center"
            >
              {status === "signed-in" ? "К сценариям" : "Начать бесплатно"}
            </Link>
          </div>

          {/* Демо-карточка: имитация сессии с говорящим оппонентом */}
          <div className="card-elevated rounded-3xl p-6 lg:p-8 flex flex-col items-center gap-4 mx-auto w-full max-w-sm lg:max-w-none">
            <OpponentAvatar avatarKey="boss" state="talking" size={120} />
            <div className="text-center">
              <p className="font-semibold">Игорь Смирнов</p>
              <p className="text-muted text-xs">Непосредственный руководитель</p>
            </div>
            <div className="rounded-2xl bg-background border border-card-border px-4 py-3 text-sm text-left w-full">
              «Ты хотел встретиться — я так понимаю, по поводу зарплаты? Слушаю, что у тебя.»
            </div>
          </div>
        </div>

        {/* Секция фич: одна колонка на мобильном, широкая сетка на десктопе */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {HIGHLIGHTS.map((h, i) => (
            <div
              key={h.title}
              className="card-elevated rounded-2xl p-5 flex flex-col gap-2 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-2xl">{h.emoji}</span>
              <p className="font-semibold text-sm">{h.title}</p>
              <p className="text-muted text-sm leading-relaxed">{h.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
