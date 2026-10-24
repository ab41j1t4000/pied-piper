# Research: Audio to Chromatic Harmonica Tabs

**Date**: 2026-10-24  
**Feature**: [spec.md](spec.md)

## Decision 1: Extract a predominant melody contour, then segment it into notes

**Decision**: Use Essentia's `PredominantPitchMelodia` as the initial Python extractor. Segment its pitch contour into note events, preserve timestamps and unvoiced gaps, and retain the algorithm's frame confidence as an internal signal. Do not enable pitch guessing during unvoiced sections. Convert segmented pitches to MIDI and map them through a C, 12-hole solo-tuning lookup table.

**Rationale**: The algorithm is specifically designed to estimate a predominant melody from polyphonic music and returns both pitch and per-frame pitch confidence. Essentia's tutorial demonstrates note segmentation into MIDI notes with onsets and durations. The Hohner 12-hole C Chromonica is specified as a three-octave C4-D7 instrument; Suzuki's note-layout chart shows the corresponding slide-out/slide-in solo-tuning positions.

**Limits**: “Predominant” does not guarantee the melody a listener considers primary. Dense accompaniment, competing lead lines, noise, percussion, or a buried melody can produce a wrong or incomplete contour. The confidence value is an algorithm signal, not a calibrated probability. Determine review thresholds against the feature's evaluation set, show low-confidence notes as uncertain, preserve unvoiced gaps, and return `NO_RELIABLE_MELODY` when the result is too incomplete to be useful. Notes outside C4-D7 must not be forced into an incorrect fingering; return them as unplayable with a warning or fail if no useful playable melody remains.

**Alternatives considered**:

- **Spotify Basic Pitch**: Apache-2.0 and supports polyphonic note transcription, but it returns multiple notes and is documented as working best on one instrument at a time. It does not directly identify the perceived lead melody, so it is not the first choice for this feature. It remains a lower-license-friction comparator if Essentia's terms are unsuitable.
- **librosa pYIN / CREPE**: Useful monophonic pitch trackers with voicing/confidence signals, but they do not select a lead from an arbitrary polyphonic soundtrack. They are better fits for isolated-melody audio than this MVP's input.

**License decision and release gate**: Essentia is available under AGPLv3 for non-commercial applications; commercial licensing is separate, and its documentation calls out third-party dependency terms. Keep the extractor behind a small Python boundary. Before a public or commercial release, confirm the project's distribution model and clear Essentia plus decoder dependencies; replace the extractor if its terms do not fit. This does not change the functional spec.

**Sources**:

- [Essentia PredominantPitchMelodia reference](https://essentia.upf.edu/reference/streaming_PredominantPitchMelodia.html)
- [Essentia melody extraction and note segmentation tutorial](https://essentia.upf.edu/tutorial_pitch_melody.html)
- [Essentia licensing information](https://essentia.upf.edu/licensing_information.html)
- [Spotify Basic Pitch repository and model limits](https://github.com/spotify/basic-pitch)
- [Hohner 12-hole C Chromonica specifications](https://hohner.de/en/instruments/harmonicas/chromatic/chromonica/super-chromonica-270-deluxe)
- [Suzuki chromatic harmonica note layout](https://www.suzuki-music.co.jp/app/uploads/SNB-48_SNB-48CVS_manual2211.pdf)

## Decision 2: Keep the first deployment stateless and synchronous

**Decision**: Use one `POST /api/transcriptions` request that accepts one audio file and returns one transcription result or a stable error response. Do not add a database, accounts, job queue, polling endpoints, or transcription history. Limit concurrent Python analyses to one initially; return a retryable busy error when the slot is occupied.

**Rationale**: The feature has no account, persistence, or catalog requirement. A single request/result path keeps the MVP small and reviewable. The frontend shows upload, analysis, result, and error states while the request is active. If observed processing time or hosting request limits make synchronous processing unsuitable, asynchronous jobs can be planned as a separate change.

## Decision 3: Stream and validate audio, then process it in a bounded Python subprocess

**Decision**: Fastify owns request validation and per-request temporary-file lifecycle. Stream the single multipart file to a unique temporary directory with explicit file-size, file-count, and part-count limits. Inspect and decode the actual media rather than trusting its filename or submitted MIME type. The Python worker uses PyAV's FFmpeg/LibAV-backed bindings to identify the first audio stream, check declared and decoded duration, and normalize to mono PCM; this avoids a separately installed system binary. Enforce the 90-second duration limit from both decoded metadata and decoded sample count. Pass the staged file and fixed settings to a Python worker launched with a fixed executable and argument array, `shell: false`, a 120-second timeout, and a concurrency guard. Return only validated result JSON. Remove all server-side temporary files in a `finally` cleanup path on success, error, timeout, cancellation, and client disconnect; clear any orphaned app-owned temporary directories at startup; log no filenames, audio bytes, or raw audio-derived content.

The initial upload byte cap is **50 MiB**. This is a practical buffer for common 90-second audio and uncompressed WAV while limiting temporary storage; make it an explicit constant and explain it in the interface. The exact accepted codec/container combinations must be confirmed against the selected PyAV wheel's bundled decoder build.

**Rationale**: Fastify's multipart parser is streaming, but multipart requests do not inherit Fastify's aggregate body limit; explicit multipart limits are required. Node's asynchronous child-process API supports timeout and abort handling. A subprocess keeps CPU-heavy Python analysis off the Node event loop and creates a clear boundary between the HTTP contract and audio model.

**Sources**:

- [Fastify multipart plugin](https://github.com/fastify/fastify-multipart) — streaming and explicit per-file/part limits
- [Node.js child_process API](https://nodejs.org/api/child_process.html) — asynchronous subprocesses, timeouts, and cancellation
- [PyAV package and bundled FFmpeg wheels](https://pypi.org/project/av/)
- [Python temporary-file utilities](https://docs.python.org/3/library/tempfile.html)

## Decision 4: Let the browser choose a supported recording MIME type

**Decision**: Capture microphone audio with the browser MediaRecorder API after explicit permission. Probe candidate recording MIME types with `MediaRecorder.isTypeSupported()`, record using a supported choice, and upload the resulting Blob with its actual MIME type. Require HTTPS outside localhost. Enforce the 90-second cap in the interface and independently on the server; the server's decoded duration is authoritative. Stop microphone tracks after stop/cancel and clear the client audio Blob/object URL when the review ends or page session ends.

**Rationale**: Browser recording containers/codecs vary. The MediaRecorder API exposes MIME selection and a capability check; microphone access requires a secure context and user permission. Dynamically choosing a supported format avoids promising one codec on every browser.

**Sources**:

- [MDN MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN MediaRecorder.isTypeSupported](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [MDN getUserMedia security and permission behavior](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Decision 5: Use a deterministic, documented tab notation

**Decision**: Store pitch as MIDI integer and map it through a documented standard solo-tuning C 12-hole lookup table. Resolve duplicate playable positions consistently: prefer slide-out, then the lowest hole among equally preferred positions. Render `4B` for hole 4 blow, slide out; `4D` for hole 4 draw, slide out; append `+` for slide-in (for example, `4B+`). Display the detected note name and timing alongside the tab. Keep octave identity internally as MIDI pitch; display scientific pitch notation C4-D7.

**Rationale**: The manufacturers document the instrument's note layout, but web tab symbols vary. An explicit legend and deterministic map make results understandable and keep equivalent pitches from randomly changing fingering between runs. The lookup table must be checked against the selected standard solo-tuning chart, including its highest-note exceptions, before accepting a mapped pitch.

**Sources**:

- [Hohner Super Chromonica 270: key, hole count, and range](https://hohner.de/en/instruments/harmonicas/chromatic/chromonica/super-chromonica-270-deluxe)
- [Suzuki C chromatic note-position chart](https://www.suzuki-music.co.jp/app/uploads/SNB-48_SNB-48CVS_manual2211.pdf)
- [Examples of differing chromatic tab conventions](https://www.harpsurgery.com/harp-theory/key-to-tab/) and [Harptabs guide](https://classic.harptabs.com/guide)

## Decision 6: Use a TypeScript web client and Fastify API in a simple three-part repository

**Decision**: Use a React + Vite TypeScript frontend, a Fastify TypeScript HTTP backend, and a Python audio worker in one repository. Serve the built frontend and API from one origin for the MVP. Node.js 22 LTS is the initial runtime target; use a Python version supported by the selected Essentia package and pin dependencies during implementation. Target a modern HTTPS browser and a Linux runtime for deployment; macOS development can use Essentia's Homebrew installation or a Linux container.

**Rationale**: Vite provides a first-party React TypeScript template and a lightweight static build. The user required TypeScript, Fastify, and Python; this split keeps each runtime's work explicit without introducing another service or data store.

**Sources**:

- [Vite getting started and React TypeScript template](https://vite.dev/guide/)
- [Essentia installation options](https://essentia.upf.edu/installing.html)

## Remaining implementation decisions for tasks

- Pin exact package versions and supported Python version after confirming Essentia package availability for the chosen local and deployment environments.
- Confirm which codec/container variants work in the selected PyAV wheel and expose only those as accepted formats.
- Tune model confidence thresholds and the no-reliable-melody cutoff using representative, rights-cleared evaluation audio; do not treat confidence as probability.
