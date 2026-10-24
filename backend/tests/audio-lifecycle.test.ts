import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { test } from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import os from 'node:os';
import path from 'node:path';
import type { FastifyRequest } from 'fastify';
import { buildApp } from '../src/app.js';
import { WorkerError } from '../src/services/python-worker.js';
import { transcribeUpload } from '../src/services/transcription-service.js';

function multipart(): { headers: Record<string, string>; payload: Buffer } {
  const boundary = 'lifecycle-boundary';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="private-name.wav"\r\nContent-Type: audio/wav\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([head, Buffer.from('audio bytes'), tail]) };
}

test('cleans staged audio after timeout and returns a stable retryable error', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pied-piper-lifecycle-'));
  const app = buildApp({
    tempRoot,
    runWorker: async () => { throw new WorkerError('PROCESSING_TIMEOUT', 504, 'Audio processing took too long.', true); },
  });
  try {
    await app.ready();
    const response = await app.inject({ method: 'POST', url: '/api/transcriptions', ...multipart() });
    assert.equal(response.statusCode, 504);
    assert.deepEqual(response.json(), { code: 'PROCESSING_TIMEOUT', message: 'Audio processing took too long.', retryable: true });
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    await app.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('cleans staged audio when analysis is cancelled', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pied-piper-cancel-'));
  const controller = new AbortController();
  let signalWorkerStarted!: () => void;
  const workerStarted = new Promise<void>((resolve) => { signalWorkerStarted = resolve; });
  const request = {
    file: async () => ({
      fieldname: 'audio',
      file: Object.assign(Readable.from(Buffer.from('private audio')), { truncated: false }),
    }),
  } as unknown as FastifyRequest;
  const transcription = transcribeUpload(request, {
    tempRoot,
    pythonExecutable: 'python3',
    timeoutMs: 120_000,
    maxFileBytes: 50 * 1024 * 1024,
    runWorker: async ({ signal }) => new Promise((_, reject) => {
      signalWorkerStarted();
      if (!signal) return reject(new Error('Expected a cancellation signal.'));
      signal.addEventListener('abort', () => reject(new WorkerError('PROCESSING_FAILED', 500, 'Cancelled.')), { once: true });
    }),
  }, controller.signal);
  try {
    await workerStarted;
    controller.abort();
    await assert.rejects(transcription);
    assert.deepEqual(await readdir(tempRoot), []);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('cancels and cleans staged audio on client disconnect without logging audio details', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pied-piper-disconnect-'));
  const logLines: string[] = [];
  let signalWorkerStarted!: () => void;
  let signalWorkerAborted!: () => void;
  const workerStarted = new Promise<void>((resolve) => { signalWorkerStarted = resolve; });
  const workerAborted = new Promise<void>((resolve) => { signalWorkerAborted = resolve; });
  const app = buildApp({
    tempRoot,
    logger: { level: 'info', stream: { write: (line: string) => { logLines.push(line); } } },
    runWorker: async ({ signal }) => new Promise<never>((_resolve, reject) => {
      if (!signal) return reject(new Error('Expected a cancellation signal.'));
      signal.addEventListener('abort', () => {
        signalWorkerAborted();
        reject(new WorkerError('PROCESSING_FAILED', 500, 'The request ended before audio processing finished.'));
      }, { once: true });
      signalWorkerStarted();
    }),
  });
  let client: ReturnType<typeof httpRequest> | undefined;
  try {
    await app.ready();
    const address = new URL(await app.listen({ host: '127.0.0.1', port: 0 }));
    const body = multipart();
    client = httpRequest({
      hostname: address.hostname,
      port: Number(address.port),
      path: '/api/transcriptions',
      method: 'POST',
      headers: { ...body.headers, 'content-length': String(body.payload.length) },
    });
    client.on('error', () => {});
    client.end(body.payload);
    await workerStarted;
    client.destroy();
    await workerAborted;

    const deadline = Date.now() + 2_000;
    while ((await readdir(tempRoot)).length > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.deepEqual(await readdir(tempRoot), []);
    const emittedLogs = logLines.join('\n');
    assert.doesNotMatch(emittedLogs, /private-name\.wav|audio bytes/i);
  } finally {
    client?.destroy();
    await app.close();
    await rm(tempRoot, { recursive: true, force: true });
  }
});
