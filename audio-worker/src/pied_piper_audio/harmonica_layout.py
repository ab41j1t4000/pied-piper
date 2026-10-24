from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Position:
    hole: int
    breath: str
    slide_in: bool
    label: str

    def to_dict(self) -> dict[str, object]:
        return {
            "hole": self.hole,
            "breath": self.breath,
            "slideIn": self.slide_in,
            "label": self.label,
        }


# Standard C 12-hole solo tuning, transcribed from the Hohner M270 tuning table.
# Slide-in draw on hole 12 is D7, the chart's upper-range exception.
BLOW_OUT = [60, 64, 67, 72, 72, 76, 79, 84, 84, 88, 91, 96]
DRAW_OUT = [62, 65, 69, 71, 74, 77, 81, 83, 86, 89, 93, 95]
BLOW_IN = [pitch + 1 for pitch in BLOW_OUT]
DRAW_IN = [pitch + 1 for pitch in DRAW_OUT[:-1]] + [98]


def build_positions() -> dict[int, Position]:
    pitch_by_position = (
        [(pitch, Position(hole, "blow", False, f"{hole}B")) for hole, pitch in enumerate(BLOW_OUT, 1)]
        + [(pitch, Position(hole, "draw", False, f"{hole}D")) for hole, pitch in enumerate(DRAW_OUT, 1)]
        + [(pitch, Position(hole, "blow", True, f"{hole}B+")) for hole, pitch in enumerate(BLOW_IN, 1)]
        + [(pitch, Position(hole, "draw", True, f"{hole}D+")) for hole, pitch in enumerate(DRAW_IN, 1)]
    )
    mapped: dict[int, Position] = {}
    for midi, position in sorted(pitch_by_position, key=lambda item: (item[1].slide_in, item[1].hole)):
        mapped.setdefault(midi, position)
    return mapped


POSITIONS = build_positions()
NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def note_name(midi: int) -> str:
    octave = midi // 12 - 1
    return f"{NOTE_NAMES[midi % 12]}{octave}"


def map_pitch(midi: int) -> Position | None:
    return POSITIONS.get(midi)
