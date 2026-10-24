from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import av
import numpy as np

from .melody import analyze_mono_audio

SAMPLE_RATE = 44100
MAX_DURATION_SECONDS = 90.0


class AudioProblem(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def decode_audio(audio_path: Path) -> tuple[np.ndarray, float]:
    accepted_formats = {"mp3", "wav", "mov", "mp4", "m4a", "ogg", "flac", "webm", "matroska", "aac"}
    # FFmpeg's default MP3 decoder reports its implementation name as mp3float.
    accepted_codecs = {"mp3", "mp3float", "mp3adu", "mp3adufloat", "aac", "vorbis", "opus", "flac"}
    try:
        container = av.open(str(audio_path), mode="r")
    except av.error.FFmpegError as error:
        raise AudioProblem("UNSUPPORTED_MEDIA") from error

    chunks: list[np.ndarray] = []
    decoded_samples = 0
    with container:
        format_names = set(container.format.name.split(","))
        if not format_names.intersection(accepted_formats):
            raise AudioProblem("UNSUPPORTED_MEDIA")
        if not container.streams.audio:
            raise AudioProblem("INVALID_AUDIO")
        stream = container.streams.audio[0]
        if stream.codec_context.name not in accepted_codecs and not stream.codec_context.name.startswith("pcm_"):
            raise AudioProblem("UNSUPPORTED_MEDIA")

        declared_duration = None
        if stream.duration is not None and stream.time_base is not None:
            declared_duration = float(stream.duration * stream.time_base)
        elif container.duration is not None:
            declared_duration = float(container.duration / av.time_base)
        if declared_duration is not None and declared_duration > MAX_DURATION_SECONDS:
            raise AudioProblem("DURATION_LIMIT_EXCEEDED")

        resampler = av.AudioResampler(format="flt", layout="mono", rate=SAMPLE_RATE)
        try:
            for frame in container.decode(stream):
                for normalized in resampler.resample(frame):
                    samples = normalized.to_ndarray().reshape(-1).astype(np.float32, copy=False)
                    decoded_samples += len(samples)
                    if decoded_samples > MAX_DURATION_SECONDS * SAMPLE_RATE:
                        raise AudioProblem("DURATION_LIMIT_EXCEEDED")
                    chunks.append(samples)
            for normalized in resampler.resample(None):
                samples = normalized.to_ndarray().reshape(-1).astype(np.float32, copy=False)
                decoded_samples += len(samples)
                if decoded_samples > MAX_DURATION_SECONDS * SAMPLE_RATE:
                    raise AudioProblem("DURATION_LIMIT_EXCEEDED")
                chunks.append(samples)
        except av.error.FFmpegError as error:
            raise AudioProblem("INVALID_AUDIO") from error

    if not chunks or decoded_samples == 0:
        raise AudioProblem("INVALID_AUDIO")
    samples = np.concatenate(chunks)
    actual_duration = len(samples) / SAMPLE_RATE
    if float(np.max(np.abs(samples))) < 1e-5 or float(np.sqrt(np.mean(samples * samples))) < 1e-5:
        raise AudioProblem("NO_RELIABLE_MELODY")
    return samples, min(actual_duration, MAX_DURATION_SECONDS)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()
    audio_path = Path(args.input)
    try:
        audio, duration = decode_audio(audio_path)
        result = analyze_mono_audio(audio, duration)
        print(json.dumps(result, separators=(",", ":")))
        return 0
    except AudioProblem as error:
        print(json.dumps({"code": error.code}), file=sys.stderr)
        return 2
    except ValueError as error:
        code = "NO_RELIABLE_MELODY" if str(error) == "NO_RELIABLE_MELODY" else "INVALID_AUDIO"
        print(json.dumps({"code": code}), file=sys.stderr)
        return 2
    except Exception:
        print(json.dumps({"code": "PROCESSING_FAILED"}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
