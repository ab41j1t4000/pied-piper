# Data Model: Audio to Chromatic Harmonica Tabs

This MVP keeps results in memory and does not persist user submissions or transcriptions.

## AudioSubmission

Represents one uploaded file or one browser recording.

| Field | Type | Rules |
|---|---|---|
| source | `upload \| browser_recording` | Required; describes how the user supplied the audio. |
| mediaType | string | Captured from the received content; never trusted alone for validation. |
| byteLength | integer | Greater than zero and at most 50 MiB. |
| durationSeconds | number | Derived from decoded audio; greater than zero and at most 90 seconds. |
| decodedSampleRate | integer | Set by the decode/normalization stage. |
| channelCount | integer | Positive; normalized to mono for melody extraction. |
| lifecycle | enum | `received`, `validated`, `processing`, `completed`, `rejected`, `failed`, `cleaned`. |

The server assigns an internal random work-directory name. The user's filename is not used as a filesystem path or logged. The original browser Blob stays client-side for playback during the review session. Server-side source and normalized audio are deleted when the request finishes, including failure, timeout, cancellation, or disconnect.

## DetectedNote

Represents one note segmented from the predominant melody contour.

| Field | Type | Rules |
|---|---|---|
| sequence | integer | Zero-based order in the result. |
| startSeconds | number | Non-negative time from the start of the supplied audio. |
| durationSeconds | number | Greater than zero; segment duration. |
| midiPitch | integer | MIDI pitch detected from the segmented contour. |
| noteName | string | Scientific pitch spelling displayed to the user, e.g. `C4` or `F#5`. |
| analyzerConfidence | number | Internal relative frame/segment signal; not a probability and not exposed as a calibrated numeric percentage. |
| confidenceBand | enum | `high` or `review`; threshold is calibrated against the evaluation set. |
| playability | enum | `playable` or `out_of_range`. |

Unvoiced contour regions remain gaps in the time sequence; they are not filled with inferred notes. The algorithm's low-confidence or out-of-range findings are retained as uncertainty/warnings rather than silently converted to another pitch.

## HarmonicaTab

The playable position associated with a detected pitch under the fixed default instrument profile.

| Field | Type | Rules |
|---|---|---|
| tuningProfile | string | `C_12_HOLE_SOLO`. |
| hole | integer or null | 1 through 12 when playable; null when no matching position exists. |
| breath | enum or null | `blow`, `draw`, or null for an out-of-range note. |
| slideIn | boolean or null | Whether the slide is pressed; null for an out-of-range note. |
| label | string or null | User-facing form such as `4B`, `4D`, `4B+`, or `4D+`; `+` means slide in. |

The worker maps MIDI pitches through a chart verified against the selected standard solo-tuning layout. Duplicate positions use the fixed priority: slide out first, then the lowest hole. No tab fingering is fabricated for pitches outside the C4-D7 profile.

## TranscriptionResult

Represents the response returned for a completed analysis.

| Field | Type | Rules |
|---|---|---|
| durationSeconds | number | Validated decoded source duration, maximum 90. |
| resultStatus | enum | `complete` or `partial`; partial includes uncertainty or unplayable notes. |
| tuningProfile | string | `C_12_HOLE_SOLO`. |
| notationLegend | string | Explains hole, blow/draw, and `+` slide-in notation. |
| notes | `DetectedNote[]` | Ordered by `startSeconds`; may have gaps. |
| warnings | `Warning[]` | User-safe codes/messages for uncertainty or out-of-range notes. |

If the worker cannot produce a useful playable sequence, it returns a `NO_RELIABLE_MELODY` error instead of an empty or misleading success result.

## Warning

| Field | Type | Rules |
|---|---|---|
| code | string | Stable code such as `LOW_CONFIDENCE_SECTION` or `NOTES_OUT_OF_RANGE`. |
| message | string | Plain-language explanation; contains no internal paths or sensitive diagnostics. |

## Lifecycle

```text
received -> validated -> processing -> completed -> cleaned
    |            |             |           |
    +-> rejected +-> rejected  +-> failed  +-> cleaned
```

All terminal paths clean server-side temporary audio. A result is returned directly to the requesting browser and is not assigned a durable ID.
