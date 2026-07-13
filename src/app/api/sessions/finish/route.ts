import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScenarioBySlug } from "@/lib/scenarios";
import { evaluateNegotiation } from "@/lib/negotiation/evaluation";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { sessionId } = (await request.json()) as { sessionId?: string };
  if (!sessionId) {
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

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }

  const scenario = getScenarioBySlug(session.scenario_slug);
  if (!scenario) {
    return NextResponse.json({ error: "unknown_scenario" }, { status: 400 });
  }

  // Уже завершена и оценена — просто вернуть существующий результат
  // вместо повторной (платной по токенам) оценки.
  const { data: existingResult } = await supabase
    .from("session_results")
    .select("*")
    .eq("session_id", session.id)
    .maybeSingle();

  if (existingResult) {
    return NextResponse.json({ result: existingResult });
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  if (!messages || messages.length < 2) {
    return NextResponse.json({ error: "not_enough_dialogue" }, { status: 400 });
  }

  try {
    const evaluation = await evaluateNegotiation(
      scenario,
      messages as { role: "user" | "opponent"; content: string }[],
    );

    const baseRow = {
      session_id: session.id,
      outcome: evaluation.outcome,
      score: evaluation.score,
      criteria_breakdown: evaluation.criteria_breakdown,
      feedback_text: evaluation.feedback_text,
    };

    let { data: savedResult, error: saveError } = await supabase
      .from("session_results")
      .insert({ ...baseRow, key_moments: evaluation.key_moments })
      .select("*")
      .single();

    if (saveError) {
      // Колонка key_moments может ещё не существовать, если миграция 0002
      // не применена — не теряем весь результат оценки из-за одного поля.
      const fallback = await supabase.from("session_results").insert(baseRow).select("*").single();
      savedResult = fallback.data;
      saveError = fallback.error;
    }

    if (saveError || !savedResult) {
      return NextResponse.json({ error: "result_save_failed" }, { status: 500 });
    }

    await supabase
      .from("sessions")
      .update({ status: "finished", finished_at: new Date().toISOString() })
      .eq("id", session.id);

    return NextResponse.json({ result: savedResult });
  } catch (e) {
    console.error("evaluation failed", e);
    return NextResponse.json({ error: "evaluation_failed" }, { status: 502 });
  }
}
