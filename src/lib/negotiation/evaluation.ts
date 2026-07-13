import type { Scenario } from "@/lib/scenarios/types";
import type { CriterionScore, Outcome } from "@/lib/types";
import { callOpenRouter, EVALUATION_MODEL, type ChatMessage } from "@/lib/openrouter";

export type EvaluationResult = {
  outcome: Outcome;
  score: number;
  criteria_breakdown: CriterionScore[];
  feedback_text: string;
};

type RawEvaluation = {
  outcome: string;
  overall_score: number;
  criteria: { key: string; score: number; comment: string }[];
  feedback: string;
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

Верни ответ СТРОГО в формате JSON, без markdown и пояснений вне JSON:
{
  "outcome": "win" | "draw" | "lose",
  "overall_score": число от 0 до 100,
  "criteria": [{ "key": "ключ_критерия", "score": число от 0 до 100, "comment": "краткий комментарий на русском, 1-2 предложения" }, ...],
  "feedback": "развёрнутый разбор на русском, 4-6 предложений: что игрок сделал хорошо, что можно улучшить, конкретный совет на будущее"
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

  return {
    outcome,
    score,
    criteria_breakdown,
    feedback_text: parsed.feedback ?? "",
  };
}
