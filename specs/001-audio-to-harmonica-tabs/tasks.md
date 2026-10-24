# Tasks: Audio to Chromatic Harmonica Tabs

**Input**: Design documents from `specs/001-audio-to-harmonica-tabs/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`, and `.specify/memory/constitution.md`

**Organization**: Tasks are grouped by user story. The complete MVP includes all three stories; User Story 1 is the first independently usable slice.

## Phase 1: Setup

**Purpose**: Establish the three runtimes and a reproducible local development path.

- [X] T001 Create the repository README and document the planned `frontend/`, `backend/`, and `audio-worker/` layout in `README.md`.
- [X] T002 [P] Bootstrap the React, Vite, and TypeScript client with build and development scripts in `frontend/package.json`, `frontend/index.html`, and `frontend/src/main.tsx`.
- [X] T003 [P] Bootstrap the Node.js 22 and Fastify TypeScript API with development and production scripts in `backend/package.json` and `backend/tsconfig.json`.
- [X] T004 [P] Bootstrap the Python worker package and declare the Essentia and decoder dependencies supported by the selected runtime in `audio-worker/pyproject.toml`.
- [X] T005 Document local prerequisites, environment configuration, and start commands consistent with `specs/001-audio-to-harmonica-tabs/quickstart.md` in `README.md`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Define the request/result boundary, configuration, and safe worker invocation used by every submission path.

**⚠️ CRITICAL**: Complete this phase before implementing user stories.

- [X] T006 Define TypeScript request, transcription, note, warning, and API error schemas matching `specs/001-audio-to-harmonica-tabs/contracts/openapi.yaml` in `backend/src/schemas/transcription.ts`.
- [X] T007 Define worker input/output models and validate the JSON protocol in `audio-worker/src/pied_piper_audio/cli.py`.
- [X] T008 Add environment-backed configuration for the Python executable, worker timeout, temporary root, and single-analysis limit in `backend/src/config.ts`.
- [X] T009 Implement unique per-request temporary directories, startup cleanup for orphaned app-owned directories, and deletion helpers in `backend/src/services/audio-temp-storage.ts`.
- [X] T010 Implement the Python subprocess adapter with a fixed executable and argument list, `shell: false`, a 120-second timeout, cancellation handling, bounded concurrency, and schema-validated output in `backend/src/services/python-worker.ts`.
- [X] T011 Register Fastify multipart handling and centralized stable error responses for the documented API errors in `backend/src/app.ts`.
- [X] T012 Add frontend TypeScript types for transcription results and documented API errors, aligned with the OpenAPI contract, in `frontend/src/features/transcription/types.ts`.

**Checkpoint**: The app shells, API contract, temporary-file lifecycle, and worker boundary are ready for the user-story slices.

---

## Phase 3: User Story 1 - Transcribe an Audio File (Priority: P1) 🎯 MVP

**Goal**: Upload one supported audio file and receive a time-ordered best-effort lead melody as C 12-hole chromatic harmonica tabs, with source playback available for review.

**Independent Test**: Upload a supported, rights-cleared recording under 90 seconds with a clear lead melody. Verify an ordered tab, tuning and notation information, source playback, and an actionable response for unsupported, invalid, silent, over-limit, or unreliable input.

### Validation for User Story 1

- [X] T013 [P] [US1] Add Python checks for note segmentation, preserved unvoiced gaps, and confidence-band behavior in `audio-worker/tests/test_note_segmentation.py`.
- [X] T014 [P] [US1] Add mapping checks for the verified C 12-hole solo-tuning chart, duplicate-position priority, slide notation, and out-of-range pitches in `audio-worker/tests/test_harmonica_layout.py`.
- [X] T015 [P] [US1] Add Fastify route checks for multipart limits and the documented success/error contract in `backend/tests/transcriptions.test.ts`.
- [X] T016 [P] [US1] Add upload-flow checks for result, busy, and actionable error states in `frontend/tests/transcription-upload.test.tsx`.

### Implementation for User Story 1

- [X] T017 [US1] Implement mono 44.1 kHz decoding/normalization and actual-media validation for MP3, WAV, M4A/AAC, OGG, FLAC, and supported WebM/Opus in `audio-worker/src/pied_piper_audio/cli.py`.
- [X] T018 [US1] Extract one predominant melody contour with Essentia, retaining frame timing, pitch, and relative confidence and leaving unvoiced regions as gaps in `audio-worker/src/pied_piper_audio/melody.py`.
- [X] T019 [US1] Segment the contour into ordered notes with onset, duration, MIDI pitch, note spelling, and qualitative confidence bands in `audio-worker/src/pied_piper_audio/note_segmentation.py`.
- [X] T020 [US1] Implement the chart-verified `C_12_HOLE_SOLO` MIDI-to-fingering lookup, preferring slide-out and then the lowest hole, and leave out-of-range notes unmapped in `audio-worker/src/pied_piper_audio/harmonica_layout.py`.
- [X] T021 [US1] Complete the worker command-line flow to return a complete/partial result or `NO_RELIABLE_MELODY` without exposing numeric confidence as a probability in `audio-worker/src/pied_piper_audio/cli.py`.
- [X] T022 [US1] Implement `POST /api/transcriptions` to accept exactly one audio file, enforce 50 MiB and decoded-duration-at-most-90-seconds limits, validate actual decodability, call the worker, validate its result, map stable errors, and clean temporary files on every exit path in `backend/src/routes/transcriptions.ts` and `backend/src/services/transcription-service.ts`.
- [X] T023 [US1] Implement the typed multipart API client and stable error decoding in `frontend/src/lib/api.ts`.
- [X] T024 [US1] Build file selection, supported-format/90-second/50 MiB guidance, submission progress, and retryable error states in `frontend/src/features/transcription/TranscriptionUpload.tsx`.
- [X] T025 [US1] Render the ordered tab result with basic tuning and notation information and local source-audio playback in `frontend/src/features/transcription/TranscriptionResult.tsx`.

**Checkpoint**: File upload can independently produce and review a tab or an actionable error.

---

## Phase 4: User Story 2 - Capture Audio in the Browser (Priority: P2)

**Goal**: Record a passage in a compatible browser and submit it through the same transcription path.

**Independent Test**: Grant microphone access, record and submit a clear passage, then verify the same result expectations as file upload. Also verify permission denial offers upload, cancel does not submit, and recording stops at 90 seconds.

### Validation for User Story 2

- [X] T026 [P] [US2] Add browser-capture checks for permission denial, cancellation, supported MIME selection, and the 90-second stop in `frontend/tests/audio-capture.test.tsx`.

### Implementation for User Story 2

- [X] T027 [US2] Implement MediaRecorder capability selection, permission/error handling, capture cancellation, a 90-second stop, and microphone-track cleanup in `frontend/src/features/transcription/useAudioCapture.ts`.
- [X] T028 [US2] Add record, stop, cancel, and submit controls that send the captured Blob with its actual MIME type through the shared transcription client in `frontend/src/features/transcription/AudioCapture.tsx`.
- [X] T029 [US2] Connect upload and capture to the same submission/result state without submitting canceled recordings in `frontend/src/features/transcription/TranscriptionPage.tsx`.

**Checkpoint**: A browser recording can independently use the upload story's API and result path.

---

## Phase 5: User Story 3 - Review and Check a Tab (Priority: P3)

**Goal**: Make timing, fingering, uncertainty, and out-of-range notes understandable while the user listens to the submitted audio.

**Independent Test**: Open a result containing high- and review-confidence notes plus an out-of-range note. Verify chronological timing, the C 12-hole tuning and notation legend, visible uncertainty and range warnings, and playback while checking the tab.

### Validation for User Story 3

- [X] T030 [P] [US3] Add result-review checks for timing order, tuning/legend, confidence distinctions, out-of-range warnings, and audio playback controls in `frontend/tests/transcription-review.test.tsx`.

### Implementation for User Story 3

- [X] T031 [US3] Show each note's start/duration, note name, tab fingering, and visibly distinct `high`/`review` confidence in `frontend/src/features/transcription/TranscriptionResult.tsx`.
- [X] T032 [US3] Show the C-tuned 12-hole profile, `B`/`D`/`+` notation legend, partial-result warnings, and out-of-range notes without fabricated fingerings in `frontend/src/features/transcription/TranscriptionResult.tsx`.
- [X] T033 [US3] Release the local source Blob and object URL when the review ends or the page session ends in `frontend/src/features/transcription/TranscriptionPage.tsx`.

**Checkpoint**: The result lets a musician judge the tab against source audio without treating uncertain notes as certain.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Close privacy, quality, usability, and release-readiness requirements across the complete MVP.

- [X] T034 Verify cleanup after success, invalid media, worker failure, timeout, cancellation, and disconnect; confirm logs omit filenames and audio-derived content in `backend/tests/audio-lifecycle.test.ts` and `backend/src/services/audio-temp-storage.ts`.
- [ ] T035 Evaluate at least 20 rights-cleared, clear single-lead recordings with a harmonica reviewer; record playability/alignment and calibrate qualitative confidence and no-reliable-result thresholds in `specs/001-audio-to-harmonica-tabs/evaluation.md`.
- [ ] T036 Record first-time-user checks for upload-to-result/actionable-error success and ability to identify tuning and notation, corresponding to SC-001 and SC-004, in `specs/001-audio-to-harmonica-tabs/evaluation.md`.
- [ ] T037 Review Essentia, FFmpeg/Libav, and decoder license terms and document whether external distribution is permitted before public or commercial release in `README.md`.
- [X] T038 Complete the end-to-end scenarios and local start instructions in `specs/001-audio-to-harmonica-tabs/quickstart.md` and `README.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; the frontend, backend, and worker bootstraps can proceed in parallel after the layout is defined.
- **Foundational (Phase 2)**: Depends on Setup; establishes shared schemas, runtime configuration, temporary storage, and the worker invocation boundary.
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers the P1 upload-to-tab MVP slice.
- **User Story 2 (Phase 4)**: Depends on the shared API and User Story 1 submission/result path; adds browser capture only.
- **User Story 3 (Phase 5)**: Depends on User Story 1 result data and playback; adds detailed review and session cleanup.
- **Polish (Phase 6)**: Depends on all three stories; verifies privacy, evaluation, usability, license gate, and quickstart.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational and is the first independently usable slice.
- **US2 (P2)**: Reuses US1's transcription endpoint and result state; it does not add a second backend analysis path.
- **US3 (P3)**: Builds on US1's result and local source playback; it adds detailed note-level review and retention cleanup.

### Parallel Opportunities

- **Setup**: T002, T003, and T004 touch separate runtime directories and can run in parallel after T001.
- **Foundational**: T006, T007, and T012 touch separate contract/type files and can proceed in parallel; T009 and T010 can proceed in parallel once their respective runtime scaffolds exist, with T010 also depending on T008 configuration.
- **US1 validation**: T013–T016 are separate test files and can be prepared in parallel after Foundational.
- **US1 implementation**: T018 and T020 touch separate worker modules after T017; T023 and T024 can proceed independently, while T025 depends on the result types and API behavior.
- **US2**: T026 can be prepared independently; T027 and T028 share the capture interface and should be coordinated, with T029 integrating both stories.
- **US3**: T030 can be prepared independently; T031 and T032 touch the same result component and should be implemented together or sequentially; T033 is separate.

## Implementation Strategy

### Complete MVP in One Pass

1. Complete Setup and Foundational phases.
2. Complete and validate US1 so upload produces a tab or a useful error.
3. Complete US2 using the same API and result path.
4. Complete US3 to make transcription timing, uncertainty, notation, playback, and local audio cleanup reviewable.
5. Complete the cross-cutting evaluation, privacy, usability, license, and quickstart tasks.

### Delivery Boundary

The MVP is complete when all three stories work end to end, evaluation criteria and error states have recorded evidence, submitted audio is cleaned up as specified, and the Essentia license gate is documented. Do not add accounts, multi-part transcription, persistence, a job queue, transcription history, or a public catalog.

## Notes

- `[P]` marks work that can proceed independently in different files after its stated prerequisites.
- Each `[USn]` maps to the corresponding story in `specs/001-audio-to-harmonica-tabs/spec.md`.
- Confidence bands are qualitative and must not be described as calibrated probabilities.
- The 50 MiB limit and 120-second worker deadline come from the implementation plan; the user-facing duration cap remains 90 seconds.

## Phase 7: Convergence

- [X] T039 Display each detected note's duration alongside its start time in the result review per US3/AC1 and T031 (partial).
- [X] T040 Add best-effort browser-side duration feedback for uploaded audio before submission, while retaining decoded server validation as authoritative, per plan: Processing Design step 1 (partial).
- [X] T041 Add lifecycle verification for an actual client disconnect and confirm logs omit submitted filenames and audio-derived content per T034, plan: Processing Design step 5, and Constitution III (partial).
