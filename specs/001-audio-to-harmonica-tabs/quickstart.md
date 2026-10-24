# Quickstart: Audio to Chromatic Harmonica Tabs

This guide describes the end-to-end validation path after implementation tasks create the app scripts and dependencies. It does not add test code or sample audio to the repository.

## Prerequisites

- Node.js 22 LTS and npm
- Python version supported by the pinned Essentia build
- Pinned PyAV dependency, which bundles FFmpeg decoder libraries
- Microphone and a modern browser; browser microphone access requires HTTPS outside localhost
- Rights-cleared audio for evaluation; do not commit user or copyrighted recordings

Review [research.md](research.md) for the Essentia license release gate before any public or commercial deployment.

## Start the application

After the bootstrap tasks establish these package scripts:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ./audio-worker
npm --prefix backend install
npm --prefix frontend install
```

Start the API and client in separate terminals:

```bash
npm --prefix backend run dev
```

```bash
npm --prefix frontend run dev
```

The frontend development server proxies `/api` to Fastify. The API must receive the worker interpreter path and temporary directory from local configuration; do not commit machine-specific paths or audio files.

## End-to-end checks

1. **Uploaded clear melody**: Upload a supported, rights-cleared MP3 or WAV under 90 seconds. Expect a time-ordered tab, C 12-hole tuning label, notation legend, note timing, confidence bands, and playback of the local source audio.
2. **Browser recording**: Grant microphone permission, record a clear melody, submit it, and verify that the same result screen appears. Confirm the recording stops at 90 seconds and the captured MIME type is preserved with the upload.
3. **Permission denied**: Deny microphone access. Expect a plain-language explanation and a working file-upload alternative.
4. **Duration and byte limits**: Submit audio longer than 90 seconds and a file larger than 50 MiB. Expect `DURATION_LIMIT_EXCEEDED` and `FILE_TOO_LARGE`, respectively, before audio analysis begins.
5. **Unsupported or corrupt audio**: Submit an unsupported container and a corrupt file. Expect actionable `UNSUPPORTED_MEDIA` or `INVALID_AUDIO` responses with no tab presented as valid.
6. **Silence and noisy/competing audio**: Submit silence, a heavily masked melody, and two similarly prominent leads. Expect a no-reliable result or clearly marked review sections; no confident-looking fabricated notes.
7. **Out-of-range melody**: Submit a clear melody with pitches outside C4-D7. Expect playable notes to remain mapped and out-of-range notes to be marked without a false fingering.
8. **Cleanup and busy behavior**: Force worker error, timeout, and a second concurrent request. Expect temporary files to be removed on every terminal path and the concurrent request to receive a retryable busy response.
9. **Quality evaluation**: On at least 20 clear, single-lead-melody recordings, have a harmonica reviewer judge whether the returned tabs are playable and aligned with the lead. Calibrate qualitative confidence bands against this set; record evaluation outcomes without retaining user submissions.

## Expected API contract

See [contracts/openapi.yaml](contracts/openapi.yaml) for the single synchronous `POST /api/transcriptions` request, response, validation limits, and stable error codes.
