import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Бесплатные нейроголоса Microsoft Edge — без ключа и лимитов.
export const TTS_VOICES = {
  male: "ru-RU-DmitryNeural",
  female: "ru-RU-SvetlanaNeural",
} as const;

export type TtsVoice = keyof typeof TTS_VOICES;

const MAX_TEXT_LENGTH = 1500;

export async function synthesizeSpeech(text: string, voice: TtsVoice = "male"): Promise<Buffer> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(TTS_VOICES[voice], OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text.trim().slice(0, MAX_TEXT_LENGTH));

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  } finally {
    tts.close();
  }
}
