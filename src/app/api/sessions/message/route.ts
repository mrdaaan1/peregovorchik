import { createClient } from "@/lib/supabase/server";
import { getScenarioBySlug } from "@/lib/scenarios";
import { buildNegotiationSystemPrompt } from "@/lib/negotiation/prompts";
import { streamOpenRouter, NEGOTIATION_MODEL, type ChatMessage } from "@/lib/openrouter";
import { synthesizeSpeech } from "@/lib/voice/tts";

export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 30;
// Разбиваем ответ на предложения, чтобы озвучивать их по мере готовности,
// не дожидаясь полного текста целиком.
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+/g;

function jsonLine(obj: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(obj)}\n\n`);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401 });
  }

  const { sessionId, text, voice } = (await request.json()) as {
    sessionId?: string;
    text?: string;
    voice?: "male" | "female";
  };
  if (!sessionId || !text?.trim()) {
    return new Response(JSON.stringify({ error: "invalid_request" }), { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) {
    return new Response(JSON.stringify({ error: "profile_not_found" }), { status: 404 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, scenario_slug, status")
    .eq("id", sessionId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!session || session.status !== "active") {
    return new Response(JSON.stringify({ error: "session_not_found" }), { status: 404 });
  }

  const scenario = getScenarioBySlug(session.scenario_slug);
  if (!scenario) {
    return new Response(JSON.stringify({ error: "unknown_scenario" }), { status: 400 });
  }

  const { error: insertUserError } = await supabase
    .from("messages")
    .insert({ session_id: session.id, role: "user", content: text.trim() });
  if (insertUserError) {
    return new Response(JSON.stringify({ error: "message_save_failed" }), { status: 500 });
  }

  const { data: history } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES);

  const chatMessages: ChatMessage[] = [
    { role: "system", content: buildNegotiationSystemPrompt(scenario) },
    ...(history ?? []).map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  // Клиент может отменить чтение стрима (закрыл вкладку, прервал ответ) до
  // того как генерация LLM/TTS завершится — тогда controller уже закрыт, и
  // дальнейшие enqueue/close должны быть no-op вместо падения с ERR_INVALID_STATE.
  const state = { closed: false };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let unspokenStart = 0;
      let audioIndex = 0;

      function safeEnqueue(chunk: Uint8Array) {
        if (state.closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          state.closed = true;
        }
      }

      function safeClose() {
        if (state.closed) return;
        state.closed = true;
        try {
          controller.close();
        } catch {
          // уже закрыт клиентом — игнорируем
        }
      }

      async function speakReady(upTo: number, force: boolean) {
        // Ищем последнюю границу предложения в ещё неозвученном хвосте.
        const pending = full.slice(unspokenStart, upTo);
        const matches = [...pending.matchAll(SENTENCE_BOUNDARY)];
        const cut = force ? pending.length : matches.length ? matches[matches.length - 1].index! : -1;
        if (cut < 0) return;

        const sentence = pending.slice(0, cut).trim();
        unspokenStart += cut;
        if (!sentence) return;

        try {
          const audio = await synthesizeSpeech(sentence, voice ?? "male");
          safeEnqueue(
            jsonLine({ type: "audio", index: audioIndex++, audio: Buffer.from(audio).toString("base64") }),
          );
        } catch (e) {
          console.error("tts chunk failed", e);
        }
      }

      // OpenRouter иногда обрывает SSE-соединение среди ответа (нестабильность
      // бесплатной модели/сети) — один retry с нуля, если не успели получить
      // ни одного токена, иначе отдаём клиенту то, что уже накопили, вместо
      // полного провала на середине фразы.
      async function runOnce() {
        for await (const delta of streamOpenRouter(NEGOTIATION_MODEL, chatMessages)) {
          if (state.closed) break;
          full += delta;
          safeEnqueue(jsonLine({ type: "delta", text: delta }));
          await speakReady(full.length, false);
        }
      }

      try {
        try {
          await runOnce();
        } catch (e) {
          if (full) throw e;
          console.warn("negotiation stream dropped with no output, retrying once", e);
          await runOnce();
        }

        await speakReady(full.length, true);

        const reply = full.trim();
        if (reply) {
          await supabase.from("messages").insert({ session_id: session.id, role: "opponent", content: reply });
        }

        safeEnqueue(jsonLine({ type: "done", reply }));
      } catch (e) {
        console.error("negotiation chat failed", e);
        safeEnqueue(jsonLine({ type: "error" }));
      } finally {
        safeClose();
      }
    },
    cancel() {
      // Клиент прервал чтение (barge-in/abort) — помечаем как закрыто,
      // чтобы текущий тик speakReady/streamOpenRouter не пытался enqueue.
      state.closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
