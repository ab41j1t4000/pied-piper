export type ConfidenceBand = 'high' | 'review';
export type Playability = 'playable' | 'out_of_range';

export interface HarmonicaPosition {
  hole: number;
  breath: 'blow' | 'draw';
  slideIn: boolean;
  label: string;
}

export interface TranscriptionNote {
  sequence: number;
  startSeconds: number;
  durationSeconds: number;
  midiPitch: number;
  noteName: string;
  confidenceBand: ConfidenceBand;
  playability: Playability;
  tab: HarmonicaPosition | null;
}

export interface Warning {
  code: 'LOW_CONFIDENCE_SECTION' | 'NOTES_OUT_OF_RANGE';
  message: string;
}

export interface TranscriptionResult {
  durationSeconds: number;
  resultStatus: 'complete' | 'partial';
  tuningProfile: 'C_12_HOLE_SOLO';
  notationLegend: 'B=blow, D=draw, + = slide in; no + = slide out';
  notes: TranscriptionNote[];
  warnings: Warning[];
}

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}
