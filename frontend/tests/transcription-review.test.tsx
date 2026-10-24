import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TranscriptionResult } from '../src/features/transcription/TranscriptionResult';
import type { TranscriptionResult as Result } from '../src/features/transcription/types';

const result: Result = {
  durationSeconds: 2.5,
  resultStatus: 'partial',
  tuningProfile: 'C_12_HOLE_SOLO',
  notationLegend: 'B=blow, D=draw, + = slide in; no + = slide out',
  notes: [
    { sequence: 0, startSeconds: 0.2, durationSeconds: 0.4, midiPitch: 60, noteName: 'C4', confidenceBand: 'high', playability: 'playable', tab: { hole: 1, breath: 'blow', slideIn: false, label: '1B' } },
    { sequence: 1, startSeconds: 0.8, durationSeconds: 0.3, midiPitch: 99, noteName: 'D#7', confidenceBand: 'review', playability: 'out_of_range', tab: null },
  ],
  warnings: [
    { code: 'LOW_CONFIDENCE_SECTION', message: 'Some notes need review.' },
    { code: 'NOTES_OUT_OF_RANGE', message: 'Some notes have no fingering.' },
  ],
};

describe('TranscriptionResult', () => {
  it('shows time-ordered notes, tuning, legend, confidence, range warnings, and playback', () => {
    render(<TranscriptionResult result={result} audioUrl="blob:source-audio" filename="melody.wav" />);
    expect(screen.getByText('C chromatic · 12 holes')).toBeInTheDocument();
    expect(screen.getByText('B = blow · D = draw · + = slide in')).toBeInTheDocument();
    expect(screen.getByText('Stronger signal')).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(screen.getByText('Outside range')).toBeInTheDocument();
    expect(screen.getByLabelText('Play submitted audio')).toHaveAttribute('src', 'blob:source-audio');
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('C4');
    expect(rows[0]).toHaveTextContent('0.4s');
    expect(rows[1]).toHaveTextContent('D#7');
    expect(rows[1]).toHaveTextContent('0.3s');
    expect(rows[1]).toHaveTextContent('—');
  });
});
