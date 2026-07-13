import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Бесплатные нейроголоса Microsoft Edge — без ключа и лимитов.
export const TTS_VOICES = {
  male: "ru-RU-DmitryNeural",
  female: "ru-RU-SvetlanaNeural",
} as const;

export type TtsVoice = keyof typeof TTS_VOICES;

const MAX_TEXT_LENGTH = 1500;
const MAX_ATTEMPTS = 3;

// В serverless-окружении (Vercel) исходящий WebSocket к MS Edge TTS рвётся
// заметно чаще, чем при локальном запуске, — повторяем синтез несколько раз,
// прежде чем сдаться, вместо того чтобы терять озвучку целого предложения.
export async function synthesizeSpeech(text: string, voice: TtsVoice = "male"): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(TTS_VOICES[voice], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(text.trim().slice(0, MAX_TEXT_LENGTH));

      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk as Buffer);
      }
      const audio = Buffer.concat(chunks);
      if (audio.length === 0) throw new Error("empty_audio");
      return audio;
    } catch (e) {
      lastError = e;
    } finally {
      tts.close();
    }
  }
  throw lastError;
}
