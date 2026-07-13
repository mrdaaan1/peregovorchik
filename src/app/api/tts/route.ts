import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { synthesizeSpeech } from "@/lib/voice/tts";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { text, voice } = (await request.json()) as { text?: string; voice?: "male" | "female" };
  if (!text?.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  try {
    const audio = await synthesizeSpeech(text, voice ?? "male");
    if (audio.length === 0) {
      return NextResponse.json({ error: "empty_audio" }, { status: 502 });
    }

    return new Response(new Uint8Array(audio), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("tts failed", e);
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  }
}
