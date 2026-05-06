"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

type Msg = {
  role: "user" | "assistant";
  text: string;
  lang?: string;
};

const LANG_LABEL: Record<string, string> = {
  "en-IN": "English",
  "hi-IN": "हिन्दी",
  "bn-IN": "বাংলা",
  "mr-IN": "मराठी",
};

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const hasConversation = messages.length > 0 || busy;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  function pickMimeType(): string {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ];
    for (const t of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
        return t;
      }
    }
    return "";
  }

  async function startRecording() {
    setError(null);

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone access.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const mr = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleStop;

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone permission denied. Please allow access in your browser."
          : "Could not access microphone: " + (err?.message || "unknown error")
      );
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  }

  async function handleStop() {
    const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    if (blob.size < 1000) {
      setError("That was too short — try speaking for a second or two.");
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      fd.append("audio", blob, "input." + ext);
      fd.append(
        "history",
        JSON.stringify(
          messages.slice(-6).map((m) => ({ role: m.role, content: m.text }))
        )
      );

      const res = await fetch("/api/voice", { method: "POST", body: fd });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Server returned ${res.status}`);
      }

      const userText = decodeURIComponent(res.headers.get("X-Transcript") || "");
      const botText = decodeURIComponent(res.headers.get("X-Reply") || "");
      const lang = res.headers.get("X-Lang") || "en-IN";

      const audioBuf = await res.arrayBuffer();
      const audioBlob = new Blob([audioBuf], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(audioBlob);

      setMessages((m) => [
        ...m,
        { role: "user", text: userText, lang },
        { role: "assistant", text: botText, lang },
      ]);

      const audio = new Audio(audioUrl);
      audio.play().catch((e) => console.warn("playback blocked:", e));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#faf6ef",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem 1.25rem 6rem",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {hasConversation && (
        <button
          onClick={clearChat}
          aria-label="Clear chat and return to home"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "transparent",
            border: "none",
            color: "#6b6b67",
            fontSize: 22,
            cursor: "pointer",
            padding: 8,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}

      {/* IDLE STATE — fades out when conversation starts */}
      <div
        style={{
          opacity: hasConversation ? 0 : 1,
          pointerEvents: hasConversation ? "none" : "auto",
          transition: "opacity 350ms ease",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          marginTop: "3vh",
          position: hasConversation ? "absolute" : "relative",
        }}
      >
        <div className="bob" style={{ width: 220, height: 220, position: "relative" }}>
          <Image
            src="/avatar.png"
            alt="Voice bot avatar"
            width={220}
            height={220}
            priority
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              background: "#f5e9d8",
            }}
          />
        </div>

        <p
          style={{
            fontStyle: "italic",
            color: "#6b6b67",
            fontSize: 14,
            margin: "1.5rem 0 1.25rem",
          }}
        >
          speaking in many tongues
        </p>

        <p style={lineStyle}>
          Multilingual (Hindi, Marathi, Bengali &amp; English) Conversation Bot
        </p>
        <p style={lineStyle}>
          Voice API by Sarvam AI — an Indian artificial intelligence company
        </p>
        <p style={{ ...lineStyle, marginBottom: "1.25rem" }}>
          Vibe Coded with Claude Opus 4.7
        </p>

        <p style={lineStyle}>knock@dasguptaneil.com</p>
      </div>

      {/* ACTIVE STATE — transcript thread */}
      <section
        style={{
          opacity: hasConversation ? 1 : 0,
          pointerEvents: hasConversation ? "auto" : "none",
          transition: "opacity 350ms ease",
          width: "100%",
          maxWidth: 560,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: "1rem",
          flex: 1,
        }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              padding: "0.6rem 0.85rem",
              borderRadius: 14,
              background: m.role === "user" ? "#2c2c2a" : "#ece5d8",
              color: m.role === "user" ? "#faf6ef" : "#3a3a37",
              fontSize: 15,
              lineHeight: 1.5,
            }}
          >
            <div>{m.text}</div>
            {m.lang && (
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.65 }}>
                {LANG_LABEL[m.lang] || m.lang}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div
            style={{
              color: "#888", fontSize: 13, fontStyle: "italic", alignSelf: "flex-start",
            }}
          >
            thinking…
          </div>
        )}

        <div ref={transcriptEndRef} />
      </section>

      {error && (
        <div
          style={{
            position: "fixed",
            bottom: 110,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "0.55rem 0.9rem",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: 8,
            fontSize: 13,
            maxWidth: "90%",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          {error}
        </div>
      )}

      {/* Mic button — fixed at bottom */}
      <div
        style={{
          position: "fixed",
          bottom: 28,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={busy}
          aria-label={recording ? "Stop recording" : "Start recording"}
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: "none",
            background: busy ? "#9b9893" : recording ? "#c0392b" : "#2c2c2a",
            color: "#faf6ef",
            fontSize: 24,
            cursor: busy ? "wait" : "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
            transition: "background 0.2s, transform 0.1s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {recording ? "■" : "🎙"}
        </button>
        <p style={{ fontSize: 11, color: "#6b6b67", margin: 0, minHeight: 14 }}>
          {busy ? "processing…" : recording ? "listening — tap to stop" : "tap to speak"}
        </p>
      </div>

      <style jsx>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .bob {
          animation: bob 3.2s ease-in-out infinite;
        }
      `}</style>
    </main>
  );
}

const lineStyle: React.CSSProperties = {
  color: "#6b6b67",
  fontSize: 14,
  lineHeight: 1.7,
  margin: "0 0 0.4rem",
  maxWidth: 520,
};
