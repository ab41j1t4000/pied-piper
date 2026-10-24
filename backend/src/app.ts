import Fastify, { type FastifyServerOptions } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerTranscriptionRoutes } from './routes/transcriptions.js';
import type { TranscriptionDependencies } from './services/transcription-service.js';
import { ApiProblem } from './schemas/transcription.js';
import type { ErrorCode } from './schemas/transcription.js';

export type AppOptions = Partial<TranscriptionDependencies> & {
  logger?: FastifyServerOptions['logger'];
};

export function buildApp(options: AppOptions = {}) {
  const dependencies: TranscriptionDependencies = {
    tempRoot: options.tempRoot ?? '.pied-piper-tmp',
    pythonExecutable: options.pythonExecutable ?? '.venv/bin/python',
    timeoutMs: options.timeoutMs ?? 120_000,
    maxFileBytes: options.maxFileBytes ?? 50 * 1024 * 1024,
    ...(options.runWorker ? { runWorker: options.runWorker } : {}),
  };
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: dependencies.maxFileBytes + 64 * 1024 });
  app.register(multipart, {
    attachFieldsToBody: false,
    throwFileSizeLimit: false,
    limits: { files: 1, fields: 0, parts: 1, fileSize: dependencies.maxFileBytes },
  });
  app.setErrorHandler((error, _request, reply) => {
    const code = (error as { code?: string }).code;
    if (code === 'FST_REQ_FILE_TOO_LARGE' || code === 'FST_FILE_TOO_LARGE') {
      return reply.code(413).send(new ApiProblem(413, 'FILE_TOO_LARGE', 'The file exceeds the 50 MiB upload limit.').toJSON());
    }
    if (code?.startsWith('FST_')) {
      return reply.code(400).send(new ApiProblem(400, 'INVALID_MULTIPART', 'Submit exactly one audio file using the audio upload field.').toJSON());
    }
    return reply.code(500).send({ code: 'PROCESSING_FAILED' as ErrorCode, message: 'The request could not be processed.', retryable: false });
  });
  app.register(async (instance) => registerTranscriptionRoutes(instance, dependencies));
  const frontendDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
  if (existsSync(frontendDist)) {
    app.register(fastifyStatic, { root: frontendDist, prefix: '/', decorateReply: false });
  }
  return app;
}
