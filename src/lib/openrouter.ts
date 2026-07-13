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

const CALL_MAX_ATTEMPTS = 3;

// OpenRouter (особенно бесплатные модели) время от времени рвёт соединение
// на середине ответа (SocketError "other side closed") — без retry это
// валило всю оценку сессии и озвучку одним сетевым сбоем.
export async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  options?: { jsonMode?: boolean },
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  let lastError: unknown;
  for (let attempt = 1; attempt <= CALL_MAX_ATTEMPTS; attempt++) {
    try {
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
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

/**
 * Стримит ответ модели по токенам (SSE), чтобы текст и озвучка могли
 * начинаться до того, как весь ответ будет сгенерирован целиком.
 */
export async function* streamOpenRouter(
  model: string,
  messages: ChatMessage[],
): AsyncGenerator<string> {
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
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const parsed = JSON.parse(payload);
        const delta: string | undefined = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // неполный/служебный SSE-чанк — пропускаем
      }
    }
  }
}
