import { createClient } from "@/lib/supabase/server";
import { getScenarioBySlug } from "@/lib/scenarios";
import { buildNegotiationSystemPrompt } from "@/lib/negotiation/prompts";
import { streamOpenRouter, NEGOTIATION_MODEL, type ChatMessage } from "@/lib/openrouter";
import { synthesizeSpeech } from "@/lib/voice/tts";

export const maxDuration = 60;

const MAX_HISTORY_MESSAGES = 30;
// Разбиваем ответ на предложения, чтобы озвучивать их по мере готовности,
// не дожидаясь полного текста целиком.
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+/;

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let unspokenStart = 0;
      let audioIndex = 0;

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
          controller.enqueue(
            jsonLine({ type: "audio", index: audioIndex++, audio: Buffer.from(audio).toString("base64") }),
          );
        } catch (e) {
          console.error("tts chunk failed", e);
        }
      }

      try {
        for await (const delta of streamOpenRouter(NEGOTIATION_MODEL, chatMessages)) {
          full += delta;
          controller.enqueue(jsonLine({ type: "delta", text: delta }));
          await speakReady(full.length, false);
        }
        await speakReady(full.length, true);

        await supabase.from("messages").insert({ session_id: session.id, role: "opponent", content: full.trim() });

        controller.enqueue(jsonLine({ type: "done", reply: full.trim() }));
      } catch (e) {
        console.error("negotiation chat failed", e);
        controller.enqueue(jsonLine({ type: "error" }));
      } finally {
        controller.close();
      }
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
