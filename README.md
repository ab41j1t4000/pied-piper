# Pied Piper

Pied Piper turns a short recording into a best-effort chromatic harmonica tab for its lead melody.

## Repository layout

- `frontend/` — React and TypeScript web client
- `backend/` — Fastify API and temporary audio lifecycle
- `audio-worker/` — Python audio decoding, melody extraction, and harmonica mapping
- `specs/001-audio-to-harmonica-tabs/` — approved MVP specification and implementation artifacts

## Local prerequisites

- Node.js 22 and npm
- Python 3.11–3.13 with a compatible Essentia wheel
- PyAV's pinned wheel, which bundles the FFmpeg decoder libraries
- A modern browser; microphone capture requires HTTPS except on localhost

Install the Python worker and JavaScript dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ./audio-worker
npm --prefix backend install
npm --prefix frontend install
```

Start the API and frontend in separate terminals:

```bash
npm --prefix backend run dev
```

```bash
npm --prefix frontend run dev
```

The frontend runs on Vite and proxies `/api` requests to Fastify on `http://localhost:3001`. The API defaults to `.pied-piper-tmp/` for transient files and uses the active Python executable. Set `PYTHON_EXECUTABLE` and `AUDIO_TEMP_ROOT` only when local defaults do not fit your environment.

## MVP limits

The app analyzes one lead melody, accepts audio up to 90 seconds and 50 MiB, and targets MP3, WAV, M4A/AAC, OGG, FLAC, and browser WebM/Opus when the bundled decoder supports the submitted codec. It does not save accounts, history, or audio. Essentia is AGPLv3 for non-commercial use; review Essentia and decoder terms before public or commercial distribution.

## Distribution status

This repository is a local prototype and is **not cleared for public or commercial distribution**. The pinned Essentia build is governed by Essentia's AGPLv3/non-commercial terms; the bundled PyAV/FFmpeg components and their codec configuration also need a distribution review. Do not publish or distribute a deployed build until those terms have been checked for the intended use.
