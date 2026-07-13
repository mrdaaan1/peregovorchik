// Ачивки вычисляются на лету из истории сессий/результатов пользователя —
// без отдельной таблицы разблокировок: источник истины (sessions,
// session_results) уже есть, а факт "разблокировано" — чистая функция от
// этих данных, что проще и надёжнее, чем держать это в синхронизации вручную.

import type { NegotiationSession, SessionResult } from "@/lib/types";

export type Achievement = {
  key: string;
  title: string;
  emoji: string;
  description: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    key: "first_session",
    title: "Первые шаги",
    emoji: "🌱",
    description: "Заверши первую тренировку переговоров",
  },
  {
    key: "first_win",
    title: "Первая победа",
    emoji: "🏆",
    description: "Добейся результата «Успех» в переговорах",
  },
  {
    key: "high_score",
    title: "Мастер аргументации",
    emoji: "🎯",
    description: "Набери 85+ баллов за одну сессию",
  },
  {
    key: "five_sessions",
    title: "Практика решает",
    emoji: "🔥",
    description: "Заверши 5 тренировок",
  },
  {
    key: "all_difficulties",
    title: "Универсал",
    emoji: "🧩",
    description: "Пройди сценарии всех уровней сложности",
  },
  {
    key: "tough_survivor",
    title: "Стальные нервы",
    emoji: "🛡️",
    description: "Заверши переговоры в сценарии с жёстким оппонентом",
  },
  {
    key: "perfect_criterion",
    title: "Безупречно",
    emoji: "💎",
    description: "Получи 95+ баллов по любому отдельному критерию оценки",
  },
];

export type SessionWithResult = {
  session: Pick<NegotiationSession, "scenario_slug" | "status">;
  result: Pick<SessionResult, "outcome" | "score" | "criteria_breakdown"> | null;
};

export function computeUnlockedAchievements(
  history: SessionWithResult[],
  scenarioDifficulty: (slug: string) => "easy" | "medium" | "hard" | undefined,
): Set<string> {
  const finished = history.filter((h) => h.session.status === "finished" && h.result);
  const unlocked = new Set<string>();

  if (finished.length >= 1) unlocked.add("first_session");
  if (finished.length >= 5) unlocked.add("five_sessions");
  if (finished.some((h) => h.result!.outcome === "win")) unlocked.add("first_win");
  if (finished.some((h) => h.result!.score >= 85)) unlocked.add("high_score");
  if (finished.some((h) => h.result!.criteria_breakdown.some((c) => c.score >= 95))) {
    unlocked.add("perfect_criterion");
  }
  if (finished.some((h) => h.session.scenario_slug === "hard-investor")) {
    unlocked.add("tough_survivor");
  }

  const difficulties = new Set(finished.map((h) => scenarioDifficulty(h.session.scenario_slug)).filter(Boolean));
  if (difficulties.has("easy") && difficulties.has("medium") && difficulties.has("hard")) {
    unlocked.add("all_difficulties");
  }

  return unlocked;
}
