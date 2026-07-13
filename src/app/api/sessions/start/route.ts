import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getScenarioBySlug } from "@/lib/scenarios";
import { buildOpeningMessage } from "@/lib/negotiation/prompts";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { scenarioSlug } = (await request.json()) as { scenarioSlug?: string };
  const scenario = scenarioSlug ? getScenarioBySlug(scenarioSlug) : undefined;
  if (!scenario) {
    return NextResponse.json({ error: "unknown_scenario" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .insert({ user_id: profile.id, scenario_slug: scenario.slug })
    .select("id")
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "session_create_failed" }, { status: 500 });
  }

  const openingLine = buildOpeningMessage(scenario);

  await supabase.from("messages").insert({
    session_id: session.id,
    role: "opponent",
    content: openingLine,
  });

  return NextResponse.json({ sessionId: session.id, openingLine });
}
