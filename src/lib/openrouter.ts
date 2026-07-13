// Клиент OpenRouter для диалога с оппонентом и финальной оценки переговоров.

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// Бесплатная модель — токенов достаточно, платных моделей пока нет.
export const NEGOTIATION_MODEL =
  process.env.OPENROUTER_NEGOTIATION_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";
export const EVALUATION_MODEL =
  process.env.OPENROUTER_EVALUATION_MODEL ?? "nvidia/nemotron-3-super-120b-a12b:free";

export async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  options?: { jsonMode?: boolean },
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://peregovorchik.vercel.app",
      "X-Title": "Peregovorchik",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const text: string | undefined = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned empty response");
  return text.trim();
}
