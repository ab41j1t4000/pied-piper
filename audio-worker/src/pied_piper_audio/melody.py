from __future__ import annotations

import numpy as np

from .note_segmentation import segment_contour


def analyze_mono_audio(audio: np.ndarray, duration_seconds: float) -> dict[str, object]:
    try:
        import essentia.standard as es
    except ImportError as error:
        raise RuntimeError("Essentia is not installed in the selected Python environment") from error

    equalized = es.EqualLoudness()(audio.astype(np.float32, copy=False))
    extractor = es.PredominantPitchMelodia(
        frameSize=2048,
        hopSize=1024,
        minFrequency=130,
        maxFrequency=1600,
        guessUnvoiced=False,
    )
    pitches, confidence = extractor(equalized)
    return segment_contour(
        pitches,
        confidence,
        duration_seconds,
        hop_seconds=1024 / 44100,
    )
