import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import type { FastifyRequest } from 'fastify';
import { createAudioWorkdir, removeAudioWorkdir } from './audio-temp-storage.js';
import { runPythonWorker, WorkerError } from './python-worker.js';
import { ApiProblem } from '../schemas/transcription.js';
import type { TranscriptionResult } from '../schemas/transcription.js';

export interface TranscriptionDependencies {
  tempRoot: string;
  pythonExecutable: string;
  timeoutMs: number;
  maxFileBytes: number;
  runWorker?: typeof runPythonWorker;
}

export async function transcribeUpload(
  request: FastifyRequest,
  dependencies: TranscriptionDependencies,
  signal: AbortSignal,
): Promise<TranscriptionResult> {
  let workdir: string | undefined;
  try {
    const part = await request.file({
      limits: { files: 1, fields: 0, parts: 1, fileSize: dependencies.maxFileBytes },
    });
    if (!part || part.fieldname !== 'audio') {
      throw new ApiProblem(400, 'INVALID_MULTIPART', 'Choose one audio file to transcribe.');
    }

    workdir = await createAudioWorkdir(dependencies.tempRoot);
    const audioPath = path.join(workdir, 'submission.audio');
    try {
      await pipeline(part.file, createWriteStream(audioPath, { flags: 'wx', mode: 0o600 }));
    } catch {
      if (part.file.truncated) throw new ApiProblem(413, 'FILE_TOO_LARGE', 'The file exceeds the 50 MiB upload limit.');
      throw new ApiProblem(400, 'INVALID_MULTIPART', 'The audio upload ended before it was complete.');
    }
    if (part.file.truncated) {
      throw new ApiProblem(413, 'FILE_TOO_LARGE', 'The file exceeds the 50 MiB upload limit.');
    }

    const worker = dependencies.runWorker ?? runPythonWorker;
    return await worker({
      pythonExecutable: dependencies.pythonExecutable,
      audioPath,
      timeoutMs: dependencies.timeoutMs,
      signal,
    });
  } catch (error) {
    if (error instanceof ApiProblem) throw error;
    if (error instanceof WorkerError) {
      throw new ApiProblem(error.statusCode, error.code, error.message, error.retryable);
    }
    const errorCode = (error as { code?: string })?.code;
    if (errorCode === 'FST_REQ_FILE_TOO_LARGE' || errorCode === 'FST_FILE_TOO_LARGE') {
      throw new ApiProblem(413, 'FILE_TOO_LARGE', 'The file exceeds the 50 MiB upload limit.');
    }
    if (errorCode?.startsWith('FST_') || errorCode === 'ERR_MULTIPART_INVALID') {
      throw new ApiProblem(400, 'INVALID_MULTIPART', 'Submit exactly one audio file using the audio upload field.');
    }
    throw error;
  } finally {
    if (workdir) await removeAudioWorkdir(workdir, dependencies.tempRoot);
  }
}
