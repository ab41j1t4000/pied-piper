from pied_piper_audio.harmonica_layout import map_pitch, note_name


def test_c4_maps_to_first_hole_blow():
    position = map_pitch(60)
    assert position is not None
    assert position.to_dict() == {"hole": 1, "breath": "blow", "slideIn": False, "label": "1B"}


def test_duplicate_note_prefers_slide_out_then_lowest_hole():
    position = map_pitch(72)  # C5 appears at holes 4, 5, and as a slide-in draw.
    assert position is not None
    assert position.label == "4B"
    assert not position.slide_in


def test_chart_upper_exception_and_range():
    position = map_pitch(98)
    assert position is not None
    assert position.label == "12D+"
    assert map_pitch(59) is None
    assert map_pitch(99) is None
    assert note_name(73) == "C#5"
