import type { FastifyInstance } from 'fastify';
import { ApiProblem } from '../schemas/transcription.js';
import { transcribeUpload, type TranscriptionDependencies } from '../services/transcription-service.js';

export async function registerTranscriptionRoutes(
  app: FastifyInstance,
  dependencies: TranscriptionDependencies,
): Promise<void> {
  app.post('/api/transcriptions', async (request, reply) => {
    const controller = new AbortController();
    const abortOnDisconnect = () => {
      if (!reply.raw.writableEnded) controller.abort();
    };
    request.raw.once('aborted', abortOnDisconnect);
    reply.raw.once('close', abortOnDisconnect);
    try {
      const result = await transcribeUpload(request, dependencies, controller.signal);
      return reply.code(200).send(result);
    } catch (error) {
      if (error instanceof ApiProblem) return reply.code(error.statusCode).send(error.toJSON());
      return reply.code(500).send({
        code: 'PROCESSING_FAILED',
        message: 'The audio could not be processed. Please try another recording.',
        retryable: false,
      });
    } finally {
      request.raw.off('aborted', abortOnDisconnect);
      reply.raw.off('close', abortOnDisconnect);
    }
  });
}
