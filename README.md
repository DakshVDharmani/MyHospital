# MyHospital
MyHospital is an online platform that can be used by NGOs to help villagers have access to services by top medical professionals right from their mobile phone.

## Project layout

- `frontend/` — the React + Vite app (login/signup, 3D scene, voice assistant widget).
- `backend/` — the Express voice-assistant server (Sarvam AI chat/TTS + Groq STT).

## Getting started

```bash
# Frontend
cd frontend
npm install
npm run dev

# Backend (optional — powers the voice assistant; the widget falls back to
# the browser's own speech APIs if this isn't running)
cd backend
npm install
cp .env.example .env   # then fill in SARVAM_API_KEY and GROQ_API_KEY
npm run dev
```
