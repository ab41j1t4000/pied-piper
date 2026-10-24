# Implementation Plan: Audio to Chromatic Harmonica Tabs

**Branch**: `001-audio-to-harmonica-tabs` | **Date**: 2026-10-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-audio-to-harmonica-tabs/spec.md`

## Summary

Build one complete path from file upload or browser microphone recording to a reviewable, time-ordered C chromatic harmonica tab. A React + Vite TypeScript client sends one audio file to a Fastify TypeScript API. Fastify validates and temporarily stages the audio, invokes an isolated Python worker, validates its result, and returns a tab plus uncertainty indicators. The Python worker uses Essentia's predominant-melody contour and note segmentation, then maps notes through a deterministic C 12-hole solo-tuning table. The first release is stateless: no accounts, database, history, or public catalog.

Essentia is the best technical fit found for a predominant melodic line, but its AGPLv3/non-commercial terms make license review a gate before public or commercial release. Keep the algorithm behind the Python worker interface so a different extractor can replace it if needed.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 22 LTS; Python 3.11–3.13 as supported by the pinned Essentia and PyAV wheels

**Primary Dependencies**: React + Vite; Fastify + `@fastify/multipart`; Essentia `PredominantPitchMelodia` and `PitchContourSegmentation`; PyAV's FFmpeg/Libav-backed bundled decoder

**Storage**: Per-request temporary files only; no database or server-side result persistence. The client keeps its original audio Blob only while the result is being reviewed.

**Testing**: Planned slice-level validation with Vitest and React Testing Library, Fastify route/contract checks, and pytest for the Python worker. The end-to-end guide uses file upload and browser capture scenarios plus a rights-cleared evaluation set. No tests are run in this planning step.

**Target Platform**: Modern HTTPS browser; Node.js API and Python worker on Linux for deployment. macOS development can use Essentia's Homebrew route or a Linux container.

**Project Type**: Single-repository web application with a TypeScript frontend, TypeScript API, and Python audio worker

**Performance Goals**: Accept one audio file up to 90 seconds and 50 MiB. Return a synchronous result within a 120-second processing deadline. Run one audio analysis at a time initially; show a busy message for concurrent submissions.

**Constraints**: The server MUST validate decoded duration, actual media decode, and explicit multipart byte/file/part limits; client MIME and filenames are untrusted. The Python process MUST be bounded by timeout and cancellation, invoked without a shell, and its stdout MUST conform to the result schema. Delete server-side temporary audio on every exit path and keep logs free of file names/audio content. Confidence thresholds are relative, require evaluation calibration, and MUST NOT be presented as probabilities. Essentia and decoder license terms require review before external distribution.

**Scale/Scope**: Small MVP with one in-flight transcription, one lead melody, C-tuned 12-hole chromatic tabs, standard audio formats, and a 90-second duration limit. No users/accounts, persistence, multi-part transcription, or public catalog.

## Constitution Check

| Principle or constraint | Plan decision | Gate |
|---|---|---|
| I. Single Lead Melody MVP | MELODIA produces one predominant pitch contour; the worker emits one note sequence only. | PASS |
| II. Honest Transcription | Preserve unvoiced gaps; derive high/review bands from evaluation; uncertain notes are visibly marked; insufficient results return a stable no-reliable-melody error. | PASS |
| III. Audio Privacy | Server input exists only in unique temporary storage; cleanup runs on success, failure, timeout, cancellation, and disconnect. The browser keeps its Blob for active review only. | PASS |
| IV. Complete, Simple User Journey | One upload/record → analyze → tab/playback path; no accounts, history, jobs database, or catalog. | PASS |
| V. Fit-for-Purpose Validation | Contract and flow checks cover accepted, invalid, over-limit, quiet/noisy, ambiguous, and out-of-range audio; quality target uses at least 20 clear lead recordings. | PASS |
| TypeScript frontend, Fastify backend, Python audio processing | React/Vite client, Fastify API, Essentia Python worker. | PASS |
| License and decoder obligations | Essentia is selected for the prototype; license/dependency review is a release gate. The worker boundary allows replacement if the terms do not fit. | PASS WITH RELEASE GATE |

No constitution violation requires a complexity exception.

## Project Structure

### Documentation (this feature)

```text
specs/001-audio-to-harmonica-tabs/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── openapi.yaml
└── tasks.md                 # Created by $speckit-tasks, not this command
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── app/
│   ├── components/
│   ├── features/transcription/
│   └── lib/api.ts
└── tests/

backend/
├── src/
│   ├── app.ts
│   ├── routes/transcriptions.ts
│   ├── schemas/transcription.ts
│   └── services/
│       ├── transcription-service.ts
│       └── python-worker.ts
└── tests/

audio-worker/
├── pyproject.toml
├── src/pied_piper_audio/
│   ├── cli.py
│   ├── melody.py
│   ├── note_segmentation.py
│   └── harmonica_layout.py
└── tests/
```

**Structure Decision**: Keep three runtime areas in one repository because the product explicitly requires a TypeScript client, Fastify API, and Python audio processing. The API owns HTTP, validation, concurrency, and temporary-file lifecycle. The Python package owns decode/normalization, predominant melody extraction, segmentation, and fingering conversion. The UI and API share the OpenAPI contract; no persistent service is introduced.

## Processing Design

1. **Choose or capture input**: The browser validates file type and duration for quick feedback. Microphone capture requests permission over HTTPS, selects a supported MediaRecorder MIME type at runtime, and stops at 90 seconds. The UI reports permission, unsupported format, and capture failures without starting analysis.
2. **Submit and validate**: `POST /api/transcriptions` accepts exactly one multipart `audio` file. Fastify applies explicit 50 MiB file, one-file, and bounded-part limits, streams to a uniquely named temporary directory, verifies that the content decodes as audio, and checks decoded duration is at most 90 seconds. PyAV uses its bundled FFmpeg/LibAV decoder libraries; do not trust client MIME or filename.
3. **Normalize and analyze**: Convert to mono float audio at the worker's configured 44.1 kHz sample rate, applying the recommended equal-loudness filter. Run `PredominantPitchMelodia` with unvoiced guessing disabled. Preserve frame time, pitch, and confidence; segment the contour into note events with onset/duration and MIDI pitch.
4. **Mark uncertainty and map tabs**: Aggregate the analyzer's per-frame confidence for each note. Thresholds are chosen from evaluation data and mapped to `high` or `review`; these are qualitative bands, not probabilities. Keep unvoiced gaps as gaps. Use a verified solo-tuning lookup table to choose a stable hole/breath/slide position. Mark out-of-range notes as unplayable and warn; if too little reliable playable melody remains, return `NO_RELIABLE_MELODY`.
5. **Respond and clean up**: Validate worker JSON against the TypeScript result schema. Return a result or stable error. Delete server temporary files in `finally`, and clear orphaned app-owned temporary directories on startup after a crash. Keep no database record. The browser retains the original Blob only during result review for playback, then releases it when review/session ends.

## API Shape

- `POST /api/transcriptions` — synchronous multipart upload; returns a transcription JSON response or a documented error. See [contracts/openapi.yaml](contracts/openapi.yaml).
- The API response contains ordered notes, start/duration, MIDI pitch and display note name, harmonica hole/breath/slide, qualitative confidence band, warnings, and the fixed tuning/notation legend.
- Error codes include `UNSUPPORTED_MEDIA`, `FILE_TOO_LARGE`, `DURATION_LIMIT_EXCEEDED`, `INVALID_AUDIO`, `NO_RELIABLE_MELODY`, `PROCESSING_BUSY`, `PROCESSING_TIMEOUT`, and `PROCESSING_FAILED`.
- No job IDs, status polling, cancel route, account identity, database writes, or saved results.

## Constitution Check (Post-Design)

| Principle | Design evidence | Gate |
|---|---|---|
| Single Lead Melody MVP | One predominant contour and one tab sequence. | PASS |
| Honest Transcription | Confidence bands, unvoiced gaps, no forced out-of-range fingering, and an explicit no-reliable-result response. | PASS |
| Audio Privacy | Per-request temp directory cleanup and session-only browser playback; no persistence or audio-bearing logs. | PASS |
| Complete, Simple User Journey | One synchronous endpoint powers upload and browser capture; result includes tab legend and source playback. | PASS |
| Fit-for-Purpose Validation | At least 20 clear single-lead examples plus negative/edge scenarios are called out in quickstart and tasks. | PASS |
| Required stack | React/Vite TypeScript, Fastify TypeScript, Python worker. | PASS |
| License terms | Essentia and decoder license check blocks public/commercial release until cleared. | PASS WITH RELEASE GATE |

## Complexity Tracking

No constitution violations or extra services are proposed. The three runtime areas are required by the chosen stack.
