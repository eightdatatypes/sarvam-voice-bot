# Sarvam Voice Bot

Multilingual voice bot — speak in English, Hindi, Bengali or Marathi, and the bot
replies in the same language. Built with Sarvam AI (Indian) + deployed on Vercel.

## Stack

- **Next.js 14 (App Router)** + TypeScript
- **Saaras v3** — speech-to-text with auto language detection
- **Sarvam-M** — chat completion, free during credit period
- **Bulbul v3** — text-to-speech in 4 Indian languages
- Vercel **Hobby tier** (10s function timeout)

## Deploy

1. Push this folder to GitHub
2. Import repo on [vercel.com/new](https://vercel.com/new)
3. Add env var `SARVAM_API_KEY` (from [dashboard.sarvam.ai](https://dashboard.sarvam.ai/))
4. Deploy

## Local dev

```bash
npm install
echo SARVAM_API_KEY=your_key_here > .env.local
npm run dev
```

Open http://localhost:3000 and tap the mic.
