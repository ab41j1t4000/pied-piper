import { spawn } from 'node:child_process';
import { parseTranscriptionResult, ApiProblem } from '../schemas/transcription.js';
import type { TranscriptionResult, ErrorCode } from '../schemas/transcription.js';

const WORKER_ERRORS: Record<string, { statusCode: number; message: string; retryable?: boolean }> = {
  UNSUPPORTED_MEDIA: { statusCode: 415, message: 'This audio format is not supported by the current audio decoder.' },
  DURATION_LIMIT_EXCEEDED: { statusCode: 422, message: 'The recording must be 90 seconds or shorter.' },
  INVALID_AUDIO: { statusCode: 422, message: 'The file could not be decoded as usable audio.' },
  NO_RELIABLE_MELODY: { statusCode: 422, message: 'A reliable lead melody could not be detected. Try a clearer recording with one prominent melody.' },
  PROCESSING_FAILED: { statusCode: 500, message: 'Audio processing failed. Please try another recording.' },
};

export class WorkerError extends Error {
  constructor(public readonly code: ErrorCode, public readonly statusCode: number, message: string, public readonly retryable = false) {
    super(message);
    this.name = 'WorkerError';
  }
}

let busy = false;

export async function runPythonWorker(options: {
  pythonExecutable: string;
  audioPath: string;
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<TranscriptionResult> {
  if (busy) throw new WorkerError('PROCESSING_BUSY', 503, 'Another audio analysis is running. Please retry shortly.', true);
  busy = true;
  try {
    return await new Promise<TranscriptionResult>((resolve, reject) => {
      const child = spawn(options.pythonExecutable, ['-m', 'pied_piper_audio.cli', '--input', options.audioPath], {
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        fn();
      };
      const abort = () => {
        child.kill('SIGKILL');
        finish(() => reject(new WorkerError('PROCESSING_FAILED', 500, 'The request ended before audio processing finished.')));
      };
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(() => reject(new WorkerError('PROCESSING_TIMEOUT', 504, 'Audio processing took too long. Try a shorter or simpler recording.', true)));
      }, options.timeoutMs);
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
        if (stdout.length > 2_000_000) child.kill('SIGKILL');
      });
      child.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-16_000); });
      child.on('error', () => finish(() => reject(new WorkerError('PROCESSING_FAILED', 500, 'The audio processor could not be started. Check the local Python and Essentia setup.'))));
      child.on('close', (code) => finish(() => {
        if (code !== 0) {
          let workerCode = 'PROCESSING_FAILED';
          try { workerCode = JSON.parse(stderr.trim().split('\n').at(-1) ?? '{}').code ?? workerCode; } catch { /* use stable fallback */ }
          const known = WORKER_ERRORS[workerCode] ?? WORKER_ERRORS.PROCESSING_FAILED!;
          reject(new WorkerError(workerCode as ErrorCode, known.statusCode, known.message, known.retryable ?? false));
          return;
        }
        try {
          resolve(parseTranscriptionResult(JSON.parse(stdout)));
        } catch {
          reject(new WorkerError('PROCESSING_FAILED', 500, 'The audio processor returned an invalid result.'));
        }
      }));
    });
  } finally {
    busy = false;
  }
}
