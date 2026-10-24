export const ERROR_CODES = [
  'INVALID_MULTIPART',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_MEDIA',
  'DURATION_LIMIT_EXCEEDED',
  'INVALID_AUDIO',
  'NO_RELIABLE_MELODY',
  'PROCESSING_BUSY',
  'PROCESSING_TIMEOUT',
  'PROCESSING_FAILED',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];
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
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export class ApiProblem extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ApiProblem';
  }

  toJSON(): ApiError {
    return { code: this.code, message: this.message, retryable: this.retryable };
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function parseTranscriptionResult(value: unknown): TranscriptionResult {
  if (!isRecord(value) || !Array.isArray(value.notes) || !Array.isArray(value.warnings)) {
    throw new Error('Invalid worker result shape');
  }
  if (
    typeof value.durationSeconds !== 'number' ||
    value.durationSeconds <= 0 ||
    value.durationSeconds > 90 ||
    !['complete', 'partial'].includes(String(value.resultStatus)) ||
    value.tuningProfile !== 'C_12_HOLE_SOLO' ||
    value.notationLegend !== 'B=blow, D=draw, + = slide in; no + = slide out'
  ) {
    throw new Error('Invalid worker result metadata');
  }

  const notes = value.notes.map((item, index): TranscriptionNote => {
    if (!isRecord(item)) throw new Error(`Invalid worker note ${index}`);
    const { tab } = item;
    const position: HarmonicaPosition | null = tab === null ? null : (() => {
      if (!isRecord(tab)) throw new Error(`Invalid worker tab ${index}`);
      if (
        !Number.isInteger(tab.hole) || Number(tab.hole) < 1 || Number(tab.hole) > 12 ||
        !['blow', 'draw'].includes(String(tab.breath)) || typeof tab.slideIn !== 'boolean' ||
        typeof tab.label !== 'string'
      ) throw new Error(`Invalid worker fingering ${index}`);
      return { hole: Number(tab.hole), breath: tab.breath as 'blow' | 'draw', slideIn: tab.slideIn, label: tab.label };
    })();

    if (
      item.sequence !== index || typeof item.startSeconds !== 'number' || item.startSeconds < 0 ||
      typeof item.durationSeconds !== 'number' || item.durationSeconds <= 0 ||
      !Number.isInteger(item.midiPitch) || typeof item.noteName !== 'string' ||
      !['high', 'review'].includes(String(item.confidenceBand)) ||
      !['playable', 'out_of_range'].includes(String(item.playability)) ||
      (item.playability === 'playable') !== (position !== null)
    ) throw new Error(`Invalid worker note fields ${index}`);

    return {
      sequence: index,
      startSeconds: item.startSeconds,
      durationSeconds: item.durationSeconds,
      midiPitch: item.midiPitch as number,
      noteName: item.noteName,
      confidenceBand: item.confidenceBand as ConfidenceBand,
      playability: item.playability as Playability,
      tab: position,
    };
  });

  if (notes.some((note, index) => index > 0 && note.startSeconds < notes[index - 1]!.startSeconds)) {
    throw new Error('Worker notes are not time ordered');
  }
  const warnings = value.warnings.map((item): Warning => {
    if (!isRecord(item) || !['LOW_CONFIDENCE_SECTION', 'NOTES_OUT_OF_RANGE'].includes(String(item.code)) || typeof item.message !== 'string') {
      throw new Error('Invalid worker warning');
    }
    return { code: item.code as Warning['code'], message: item.message };
  });
  return {
    durationSeconds: value.durationSeconds,
    resultStatus: value.resultStatus as TranscriptionResult['resultStatus'],
    tuningProfile: 'C_12_HOLE_SOLO',
    notationLegend: 'B=blow, D=draw, + = slide in; no + = slide out',
    notes,
    warnings,
  };
}
