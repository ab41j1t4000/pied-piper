import math
import struct
import wave

import av
import numpy as np
import pytest

from pied_piper_audio.cli import AudioProblem, decode_audio
from pied_piper_audio.melody import analyze_mono_audio


def write_wav(path, duration: float, tone: bool = True) -> None:
    rate = 44100
    frame_count = round(rate * duration)
    with wave.open(str(path), "wb") as audio_file:
        audio_file.setnchannels(1)
        audio_file.setsampwidth(2)
        audio_file.setframerate(rate)
        frames = bytearray()
        for index in range(frame_count):
            time = index / rate
            if not tone:
                sample = 0
            else:
                notes = [523.25, 587.33, 659.25, 698.46, 659.25, 587.33]
                note = notes[min(int(time / (duration / len(notes))), len(notes) - 1)]
                sample = int(7000 * (
                    math.sin(2 * math.pi * note * time)
                    + 0.35 * math.sin(4 * math.pi * note * time)
                    + 0.15 * math.sin(6 * math.pi * note * time)
                ))
            frames.extend(struct.pack("<h", sample))
        audio_file.writeframes(frames)


def write_mp3(path) -> None:
    output = av.open(str(path), mode="w", format="mp3")
    stream = output.add_stream("libmp3lame", rate=44100)
    stream.layout = "mono"
    samples = (np.sin(2 * np.pi * 440 * np.arange(44100) / 44100) * 8000).astype(np.int16).reshape(1, -1)
    frame = av.AudioFrame.from_ndarray(samples, format="s16", layout="mono")
    frame.sample_rate = 44100
    for packet in stream.encode(frame):
        output.mux(packet)
    for packet in stream.encode(None):
        output.mux(packet)
    output.close()


def test_decodes_and_analyzes_a_short_clear_wav(tmp_path):
    path = tmp_path / "sample.wav"
    write_wav(path, 1.4)
    audio, duration = decode_audio(path)
    assert duration == pytest.approx(1.4, abs=0.01)
    assert len(audio) == pytest.approx(1.4 * 44100, abs=500)
    result = analyze_mono_audio(audio, duration)
    assert result["notes"]
    assert result["tuningProfile"] == "C_12_HOLE_SOLO"
    assert all("analyzerConfidence" not in note for note in result["notes"])


def test_decodes_mp3_using_ffmpeg_float_decoder_name(tmp_path):
    path = tmp_path / "sample.mp3"
    write_mp3(path)
    audio, duration = decode_audio(path)
    assert duration == pytest.approx(1.0, abs=0.1)
    assert audio.size > 0


def test_rejects_silent_audio_as_no_reliable_melody(tmp_path):
    path = tmp_path / "silence.wav"
    write_wav(path, 0.5, tone=False)
    with pytest.raises(AudioProblem, match="NO_RELIABLE_MELODY"):
        decode_audio(path)


def test_rejects_audio_longer_than_90_seconds(tmp_path):
    path = tmp_path / "too-long.wav"
    write_wav(path, 90.1)
    with pytest.raises(AudioProblem, match="DURATION_LIMIT_EXCEEDED"):
        decode_audio(path)


def test_rejects_corrupt_audio(tmp_path):
    path = tmp_path / "corrupt.wav"
    path.write_bytes(b"not audio")
    with pytest.raises(AudioProblem):
        decode_audio(path)
