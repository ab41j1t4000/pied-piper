# Feature Specification: Audio to Chromatic Harmonica Tabs

**Feature Branch**: `001-audio-to-harmonica-tabs`

**Created**: 2026-10-24

**Status**: Draft

**Input**: User description: Build a web app that accepts browser-captured or uploaded audio, identifies one best-effort lead melody, and returns time-ordered chromatic harmonica tabs for a C-tuned, 12-hole harmonica. The MVP excludes multi-part transcription, accounts, and a public catalog.

## Clarifications

### Session 2026-10-24

- Q: What audio formats and maximum duration should the MVP accept? → A: Common standard audio formats, with a maximum duration of 1 minute 30 seconds.

## User Scenarios & Testing

### User Story 1 - Transcribe an audio file (Priority: P1)

A musician uploads a recording of a song and receives a playable chromatic harmonica tab for its main melody.

**Why this priority**: Uploading a recording is the most direct way to turn an existing song into something the musician can learn and check.

**Independent Test**: Upload a supported recording with a clear lead melody and verify that a time-ordered chromatic harmonica tab is returned with the source audio available for review.

**Acceptance Scenarios**:

1. **Given** a supported recording with a clear lead melody, **When** the user submits it, **Then** the app returns a time-ordered chromatic harmonica tab for one best-effort lead melody.
2. **Given** an unsupported, invalid, unusable, or longer-than-90-second audio file, **When** the user submits it, **Then** the app explains the issue and how to provide supported audio within the duration limit.
3. **Given** a recording with no reliably detectable lead melody, **When** the app processes it, **Then** it reports that a reliable tab could not be produced instead of presenting an uncertain transcription as certain.

### User Story 2 - Capture audio in the browser (Priority: P2)

A musician records a short passage through the browser and submits it to receive chromatic harmonica tabs.

**Why this priority**: Browser capture lets users identify a melody without first saving a recording elsewhere.

**Independent Test**: Grant microphone access, record a clear melody, submit it, and verify that the app returns tabs or a useful explanation of why it could not.

**Acceptance Scenarios**:

1. **Given** microphone access is available and granted, **When** the user records and submits a passage, **Then** the app processes that recording using the same result expectations as an uploaded file.
2. **Given** microphone access is denied or unavailable, **When** the user tries to record, **Then** the app explains the issue and offers file upload as an alternative.
3. **Given** the user stops or cancels a recording before submission, **When** the capture ends, **Then** the app does not submit the recording for transcription.
4. **Given** a browser recording reaches 1 minute 30 seconds, **When** the duration limit is reached, **Then** capture stops and the app explains the limit.

### User Story 3 - Review and check a tab (Priority: P3)

A musician reviews the returned tab alongside playback of the supplied audio to check whether the transcription matches the melody.

**Why this priority**: A musician needs enough context to understand the notation and judge the result before relying on it.

**Independent Test**: Open a completed transcription and verify the note order, chromatic harmonica notation, tuning information, uncertainty indicators, and audio playback.

**Acceptance Scenarios**:

1. **Given** a completed transcription, **When** the user reviews the result, **Then** notes appear in time order using a consistent chromatic harmonica notation and the result identifies the C-tuned, 12-hole harmonica.
2. **Given** parts of a transcription are uncertain, **When** the user reviews the result, **Then** uncertain notes or sections are visibly distinguished from more confident ones.
3. **Given** the transcription result is displayed, **When** the user plays the supplied audio, **Then** they can listen while checking the tab.
4. **Given** the user ends the review or the session ends, **When** the submitted audio is no longer needed, **Then** the app discards it and does not reuse it for another purpose without explicit consent.

### Edge Cases

- Audio contains chords, accompaniment, multiple simultaneous melodies, or a lead that changes instruments.
- The melody is quiet, noisy, distorted, masked by accompaniment, or outside the supported harmonica range.
- The submission is silent, extremely short, corrupted, or has a long section without sound.
- The format or file size is unsupported, or the audio exceeds the 1 minute 30 second duration limit; the app communicates supported limits before or at submission.
- Microphone permission is denied, capture is unavailable, or the user cancels capture.
- Processing fails, takes unusually long, or the user leaves the page before completion.
- A melody note cannot be represented within the selected harmonica's playable range.

## Requirements

### Functional Requirements

- **FR-001**: Users MUST be able to submit an audio file for transcription.
- **FR-002**: Users MUST be able to record audio through a compatible browser and submit the recording for transcription.
- **FR-003**: The system MUST identify one best-effort lead melody from a submitted recording; it MUST NOT attempt to return multiple simultaneous parts in the MVP.
- **FR-004**: The system MUST convert the detected melody into time-ordered chromatic harmonica tabs for a C-tuned, 12-hole chromatic harmonica.
- **FR-005**: Each result MUST identify the harmonica tuning and explain the tab notation used, including hole, breath direction, and chromatic alteration where applicable.
- **FR-006**: The system MUST communicate uncertainty at the note or section level when available, and MUST explain when it cannot produce a reliable result.
- **FR-007**: The system MUST provide actionable feedback for unsupported, invalid, silent, corrupted, or unprocessable audio.
- **FR-008**: Users MUST be able to play back their submitted audio while reviewing a completed tab.
- **FR-009**: The system MUST support canceling browser capture before submission and MUST NOT transcribe a canceled recording.
- **FR-010**: Submitted audio MUST be kept only as long as needed for transcription and in-session review; it MUST be discarded when the user ends the review or the session ends, and MUST NOT be reused for another purpose without explicit user consent.
- **FR-011**: The MVP MUST NOT require accounts or provide a public transcription catalog.
- **FR-012**: The system MUST accept common standard audio formats, including MP3, WAV, M4A/AAC, OGG, FLAC, and browser-captured WebM/Opus when supported by the user's browser. It MUST limit each uploaded or captured submission to 1 minute 30 seconds and explain the limit when audio exceeds it.

### Key Entities

- **Audio submission**: A user-provided file or browser recording, including its duration, format, and processing state.
- **Detected melody**: The single ordered sequence of notes identified as the best-effort lead melody, with timing and confidence information where available.
- **Harmonica tab**: The playable representation of detected notes using harmonica hole, breath direction, chromatic alteration, and tuning.
- **Transcription result**: The tab and its confidence or failure information, associated with the submitted audio for review and playback.

## Success Criteria

### Measurable Outcomes

- **SC-001**: At least 4 out of 5 first-time users can submit an audio file and locate the returned tab or actionable error without assistance.
- **SC-002**: In an evaluation set of at least 20 clear, single-lead-melody recordings, at least 80% of returned tabs are judged playable and aligned with the lead melody by a harmonica reviewer.
- **SC-003**: At least 90% of silent, unsupported, over-limit, corrupted, or otherwise unusable submissions receive an actionable explanation instead of a misleading tab.
- **SC-004**: At least 4 out of 5 first-time users can identify how to read the returned tab and the harmonica tuning from the result screen.
- **SC-005**: In 100% of reviewed sessions, submitted audio is unavailable after the user ends the review or the session ends, and is not reused without explicit consent.

## Assumptions

- The primary user is a musician who wants to learn or check the main melody of an existing recording.
- The initial harmonica is C-tuned and has 12 chromatic holes.
- Browser capture records a passage first; transcription begins only after the user submits it.
- The first release publishes its accepted formats and file-size limit in the interface. MP3, WAV, M4A/AAC, OGG, FLAC, and browser-captured WebM/Opus are the target common formats; exact codec compatibility and file-size limits are confirmed during planning.
- Audio may contain accompaniment, but only one best-effort lead melody is in scope; quality may be lower for dense or noisy recordings.
- Users do not need accounts, saved transcription history, or a public catalog for the MVP.
