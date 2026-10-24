import math

import pytest

from pied_piper_audio.note_segmentation import segment_contour


def hz(midi: int) -> float:
    return 440 * (2 ** ((midi - 69) / 12))


def test_segments_ordered_notes_and_preserves_unvoiced_gaps():
    pitches = [hz(60)] * 35 + [0.0] * 30 + [hz(62)] * 35
    confidence = [0.8] * len(pitches)
    result = segment_contour(pitches, confidence, 1.0, hop_seconds=0.01)
    assert [note["noteName"] for note in result["notes"]] == ["C4", "D4"]
    first, second = result["notes"]
    assert first["startSeconds"] == 0
    assert second["startSeconds"] > first["startSeconds"] + first["durationSeconds"]
    assert result["resultStatus"] == "complete"


def test_marks_weaker_frames_for_review_without_probability_values():
    pitches = [hz(60)] * 70 + [hz(62)] * 70
    confidence = [0.2] * 70 + [0.9] * 70
    result = segment_contour(pitches, confidence, 1.8)
    assert [note["confidenceBand"] for note in result["notes"]] == ["review", "high"]
    assert "analyzerConfidence" not in result["notes"][0]
    assert result["warnings"][0]["code"] == "LOW_CONFIDENCE_SECTION"


def test_rejects_too_little_playable_melody():
    with pytest.raises(ValueError, match="NO_RELIABLE_MELODY"):
        segment_contour([0.0] * 80, [0.0] * 80, 0.25)


def test_requires_matching_frame_arrays():
    with pytest.raises(ValueError, match="same length"):
        segment_contour([hz(60)], [], 0.1)
