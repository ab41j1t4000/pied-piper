import type { ApiError, TranscriptionResult } from '../features/transcription/types';

export class TranscriptionApiError extends Error {
  constructor(public readonly detail: ApiError) {
    super(detail.message);
    this.name = 'TranscriptionApiError';
  }
}

export async function createTranscription(
  audio: Blob,
  filename: string,
  signal?: AbortSignal,
): Promise<TranscriptionResult> {
  const form = new FormData();
  form.append('audio', audio, filename);
  let response: Response;
  try {
    response = await fetch('/api/transcriptions', { method: 'POST', body: form, signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new TranscriptionApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the audio processor. Check your connection and try again.',
      retryable: true,
    });
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body as Partial<ApiError> | null;
    throw new TranscriptionApiError({
      code: detail?.code ?? 'PROCESSING_FAILED',
      message: detail?.message ?? 'The audio could not be processed. Please try another recording.',
      retryable: detail?.retryable ?? false,
    });
  }
  if (!body || typeof body !== 'object' || !Array.isArray((body as TranscriptionResult).notes)) {
    throw new TranscriptionApiError({
      code: 'PROCESSING_FAILED',
      message: 'The audio processor returned an incomplete result. Please try again.',
      retryable: false,
    });
  }
  return body as TranscriptionResult;
}
