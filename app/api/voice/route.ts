import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const SARVAM_API_KEY = process.env.SARVAM_API_KEY!;
const SARVAM_BASE = "https://api.sarvam.ai";

const SUPPORTED_LANGS = new Set(["en-IN", "hi-IN", "bn-IN", "mr-IN"]);
const FALLBACK_LANG = "en-IN";

const LANG_NAMES: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "bn-IN": "Bengali",
  "mr-IN": "Marathi",
};

async function transcribe(audio: Blob, filename: string) {
  // Sarvam rejects MIME types with codec parameters like "audio/webm;codecs=opus".
  // Strip everything after the semicolon so we send a clean type they accept.
  const cleanType = (audio.type || "audio/webm").split(";")[0].trim();
  const cleanBlob = new Blob([await audio.arrayBuffer()], { type: cleanType });

  const fd = new FormData();
  fd.append("file", cleanBlob, filename);
  fd.append("model", "saaras:v3");
  fd.append("with_timestamps", "false");

  const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
    method: "POST",
    headers: { "api-subscription-key": SARVAM_API_KEY },
    body: fd,
  });

  if (!res.ok) throw new Error(`STT failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  let lang: string = data.language_code || FALLBACK_LANG;
  if (!SUPPORTED_LANGS.has(lang)) lang = FALLBACK_LANG;

  return { transcript: (data.transcript as string) || "", lang };
}

async function chat(
  userText: string,
  lang: string,
  history: Array<{ role: string; content: string }>
) {
  const langName = LANG_NAMES[lang] || "English";

  const systemPrompt =
    `You are a friendly multilingual voice assistant. ` +
    `The user is speaking ${langName}. ` +
    `Reply ONLY in ${langName}. Keep replies to ONE short sentence, max 100 characters, ` +
    `suitable for being read aloud. Do not mix languages. No markdown, no bullets.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userText },
  ];

  const res = await fetch(`${SARVAM_BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SARVAM_API_KEY}`,
    },
    body: JSON.stringify({
      model: "sarvam-m",
      messages,
      temperature: 0.5,
      max_tokens: 120,
    }),
  });

  if (!res.ok) throw new Error(`Chat failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function synthesize(text: string, lang: string): Promise<Buffer> {
  const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": SARVAM_API_KEY,
    },
    body: JSON.stringify({
      text,
      target_language_code: lang,
      model: "bulbul:v3",
      speaker: "anand",
      pace: 1.0,
      enable_preprocessing: true,
    }),
  });

  if (!res.ok) throw new Error(`TTS failed (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const b64 = data.audios?.[0];
  if (!b64) throw new Error("TTS returned no audio");
  return Buffer.from(b64, "base64");
}

export async function POST(req: NextRequest) {
  if (!SARVAM_API_KEY) {
    return NextResponse.json(
      { error: "SARVAM_API_KEY env var is not set on the server" },
      { status: 500 }
    );
  }

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const historyRaw = form.get("history");

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "No audio uploaded" }, { status: 400 });
    }

    const history = historyRaw
      ? (JSON.parse(historyRaw.toString()) as Array<{
          role: string;
          content: string;
        }>)
      : [];

    const { transcript, lang } = await transcribe(audio, "input.webm");

    if (!transcript) {
      return NextResponse.json(
        { error: "No speech detected. Try again." },
        { status: 422 }
      );
    }

    const reply = await chat(transcript, lang, history);
    const audioBuf = await synthesize(reply, lang);

    return new NextResponse(new Uint8Array(audioBuf), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "X-Transcript": encodeURIComponent(transcript),
        "X-Reply": encodeURIComponent(reply),
        "X-Lang": lang,
      },
    });
  } catch (err: any) {
    console.error("voice route error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}
