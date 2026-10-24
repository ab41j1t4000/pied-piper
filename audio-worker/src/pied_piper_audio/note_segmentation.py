from __future__ import annotations

import math
from collections.abc import Sequence

from .harmonica_layout import map_pitch, note_name


def _percentile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int((len(ordered) - 1) * fraction))]


def segment_contour(
    pitches_hz: Sequence[float],
    confidences: Sequence[float],
    duration_seconds: float,
    hop_seconds: float = 1024 / 44100,
) -> dict[str, object]:
    if len(pitches_hz) != len(confidences):
        raise ValueError("Pitch and confidence frame arrays must have the same length")

    frames: list[tuple[int | None, float]] = []
    voiced_confidence: list[float] = []
    for pitch, confidence in zip(pitches_hz, confidences, strict=True):
        if not math.isfinite(float(pitch)) or float(pitch) <= 0 or not math.isfinite(float(confidence)) or float(confidence) <= 0:
            frames.append((None, 0.0))
            continue
        midi = round(69 + 12 * math.log2(float(pitch) / 440))
        confidence_value = max(0.0, float(confidence))
        frames.append((midi, confidence_value))
        voiced_confidence.append(confidence_value)

    # These labels describe signal strength within this recording; they are not probabilities.
    review_floor = max(0.01, _percentile(voiced_confidence, 0.2))
    strong_signal = max(review_floor, _percentile(voiced_confidence, 0.65))
    raw_segments: list[dict[str, float | int]] = []
    active_pitch: int | None = None
    start_index = 0
    segment_confidences: list[float] = []

    def flush(end_index: int) -> None:
        nonlocal active_pitch, segment_confidences
        if active_pitch is None:
            return
        start_seconds = start_index * hop_seconds
        duration = min((end_index - start_index) * hop_seconds, max(0.0, duration_seconds - start_seconds))
        if duration >= 0.07:
            raw_segments.append({
                "midiPitch": active_pitch,
                "startSeconds": start_seconds,
                "durationSeconds": duration,
                "analyzerConfidence": sum(segment_confidences) / max(1, len(segment_confidences)),
            })
        active_pitch = None
        segment_confidences = []

    for index, (pitch, confidence) in enumerate(frames):
        reliable_enough = pitch is not None and confidence >= review_floor
        next_pitch = pitch if reliable_enough else None
        if next_pitch != active_pitch:
            flush(index)
            if next_pitch is not None:
                active_pitch = next_pitch
                start_index = index
                segment_confidences = [confidence]
        elif next_pitch is not None:
            segment_confidences.append(confidence)
    flush(len(frames))

    notes: list[dict[str, object]] = []
    for item in raw_segments:
        midi = int(item["midiPitch"])
        average_confidence = float(item["analyzerConfidence"])
        position = map_pitch(midi)
        notes.append({
            "sequence": len(notes),
            "startSeconds": round(float(item["startSeconds"]), 3),
            "durationSeconds": round(float(item["durationSeconds"]), 3),
            "midiPitch": midi,
            "noteName": note_name(midi),
            "confidenceBand": "high" if average_confidence >= strong_signal - 1e-9 else "review",
            "playability": "playable" if position else "out_of_range",
            "tab": position.to_dict() if position else None,
        })

    playable_time = sum(float(note["durationSeconds"]) for note in notes if note["playability"] == "playable")
    if len(notes) < 2 or playable_time < 0.18:
        raise ValueError("NO_RELIABLE_MELODY")

    warnings: list[dict[str, str]] = []
    if any(note["confidenceBand"] == "review" for note in notes):
        warnings.append({"code": "LOW_CONFIDENCE_SECTION", "message": "Some notes have a weaker analyzer signal and need review by ear."})
    if any(note["playability"] == "out_of_range" for note in notes):
        warnings.append({"code": "NOTES_OUT_OF_RANGE", "message": "Some detected notes are outside this harmonica's playable range and have no fingering."})

    return {
        "durationSeconds": round(duration_seconds, 3),
        "resultStatus": "partial" if warnings else "complete",
        "tuningProfile": "C_12_HOLE_SOLO",
        "notationLegend": "B=blow, D=draw, + = slide in; no + = slide out",
        "notes": notes,
        "warnings": warnings,
    }
