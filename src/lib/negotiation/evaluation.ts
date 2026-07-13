import type { Scenario } from "@/lib/scenarios/types";
import type { CriterionScore, KeyMoment, Outcome } from "@/lib/types";
import { callOpenRouter, EVALUATION_MODEL, type ChatMessage } from "@/lib/openrouter";

export type EvaluationResult = {
  outcome: Outcome;
  score: number;
  criteria_breakdown: CriterionScore[];
  feedback_text: string;
  key_moments: KeyMoment[];
};

type RawEvaluation = {
  outcome: string;
  overall_score: number;
  criteria: { key: string; score: number; comment: string }[];
  feedback: string;
  key_moments?: { quote: string; verdict: string; comment: string }[];
};

function buildEvaluationSystemPrompt(scenario: Scenario): string {
  const criteriaList = scenario.evaluationCriteria
    .map((c) => `- ${c.key} ("${c.label}", вес ${c.weight}): ${c.description}`)
    .join("\n");

  return `Ты — независимый эксперт по деловым переговорам, оценивающий завершённую тренировочную сессию. Тебе дан полный текст диалога между игроком и оппонентом (роль: ${scenario.opponentRole}, ${scenario.opponentName}) в сценарии "${scenario.title}".

Скрытый контекст сценария, который ты как эксперт знаешь (игрок этого не видел заранее):
- Скрытые интересы оппонента: ${scenario.opponent.hiddenInterests.join("; ")}
- BATNA оппонента: ${scenario.opponent.batna}
- Граница уступок оппонента: ${scenario.opponent.walkAwayCondition}

Оцени игрока по следующим критериям (используй Гарвардский метод переговоров, принципы SPIN и понятие BATNA как рамку анализа):
${criteriaList}

Дополнительно выбери 2-4 конкретных ключевых момента диалога — дословные цитаты реплик ИГРОКА (не оппонента), которые сильнее всего повлияли на исход: и удачные, и неудачные. Для каждой цитаты объясни, какую переговорную технику она иллюстрирует (Гарвардский метод/SPIN/работа с BATNA/деэскалация) и почему это сработало или не сработало.

Верни ответ СТРОГО в формате JSON, без markdown и пояснений вне JSON:
{
  "outcome": "win" | "draw" | "lose",
  "overall_score": число от 0 до 100,
  "criteria": [{ "key": "ключ_критерия", "score": число от 0 до 100, "comment": "краткий комментарий на русском, 1-2 предложения" }, ...],
  "feedback": "развёрнутый разбор на русском, 4-6 предложений: что игрок сделал хорошо, что можно улучшить, конкретный совет на будущее",
  "key_moments": [{ "quote": "дословная цитата реплики игрока", "verdict": "good" | "bad", "comment": "почему это сработало/не сработало, с привязкой к технике" }, ...]
}

outcome определяй так: "win" — игрок добился условий, близких к своей цели, не жертвуя интересами; "draw" — компромисс хуже цели, но не провальный; "lose" — итог явно хуже цели игрока или переговоры сорвались.`;
}

export async function evaluateNegotiation(
  scenario: Scenario,
  transcript: { role: "user" | "opponent"; content: string }[],
): Promise<EvaluationResult> {
  const transcriptText = transcript
    .map((m) => `${m.role === "user" ? "Игрок" : scenario.opponentName}: ${m.content}`)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: buildEvaluationSystemPrompt(scenario) },
    { role: "user", content: `Вот полный текст переговоров:\n\n${transcriptText}` },
  ];

  const raw = await callOpenRouter(EVALUATION_MODEL, messages, { jsonMode: true });

  let parsed: RawEvaluation;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Модель иногда оборачивает JSON в текст, несмотря на инструкцию — вырезаем первый {...} блок.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("evaluation_not_json");
    parsed = JSON.parse(match[0]);
  }

  const outcome: Outcome = ["win", "draw", "lose"].includes(parsed.outcome) ? (parsed.outcome as Outcome) : "draw";
  const score = Math.max(0, Math.min(100, Math.round(parsed.overall_score)));

  const criteria_breakdown: CriterionScore[] = scenario.evaluationCriteria.map((def) => {
    const found = parsed.criteria?.find((c) => c.key === def.key);
    return {
      criterion: def.key,
      label: def.label,
      score: found ? Math.max(0, Math.min(100, Math.round(found.score))) : 0,
      comment: found?.comment ?? "",
    };
  });

  const key_moments: KeyMoment[] = (parsed.key_moments ?? [])
    .filter((m) => m.quote && m.comment)
    .map((m) => ({
      quote: m.quote,
      verdict: m.verdict === "bad" ? "bad" : "good",
      comment: m.comment,
    }));

  return {
    outcome,
    score,
    criteria_breakdown,
    feedback_text: parsed.feedback ?? "",
    key_moments,
  };
}
