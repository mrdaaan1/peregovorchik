import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScenarioBySlug } from "@/lib/scenarios";
import { buildNegotiationSystemPrompt } from "@/lib/negotiation/prompts";
import { callOpenRouter, NEGOTIATION_MODEL, type ChatMessage } from "@/lib/openrouter";

const MAX_HISTORY_MESSAGES = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { sessionId, text } = (await request.json()) as { sessionId?: string; text?: string };
  if (!sessionId || !text?.trim()) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id, scenario_slug, status")
    .eq("id", sessionId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const scenario = getScenarioBySlug(session.scenario_slug);
  if (!scenario) {
    return NextResponse.json({ error: "unknown_scenario" }, { status: 400 });
  }

  const { error: insertUserError } = await supabase
    .from("messages")
    .insert({ session_id: session.id, role: "user", content: text.trim() });
  if (insertUserError) {
    return NextResponse.json({ error: "message_save_failed" }, { status: 500 });
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

  try {
    const reply = await callOpenRouter(NEGOTIATION_MODEL, chatMessages);

    await supabase.from("messages").insert({ session_id: session.id, role: "opponent", content: reply });

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("negotiation chat failed", e);
    return NextResponse.json({ error: "chat_failed" }, { status: 502 });
  }
}
