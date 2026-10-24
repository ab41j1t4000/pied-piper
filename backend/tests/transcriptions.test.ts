import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildApp } from '../src/app.js';
import { WorkerError } from '../src/services/python-worker.js';
import type { TranscriptionResult } from '../src/schemas/transcription.js';

const result: TranscriptionResult = {
  durationSeconds: 1,
  resultStatus: 'complete',
  tuningProfile: 'C_12_HOLE_SOLO',
  notationLegend: 'B=blow, D=draw, + = slide in; no + = slide out',
  notes: [{ sequence: 0, startSeconds: 0, durationSeconds: 0.3, midiPitch: 60, noteName: 'C4', confidenceBand: 'high', playability: 'playable', tab: { hole: 1, breath: 'blow', slideIn: false, label: '1B' } }],
  warnings: [],
};

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(maxFileBytes = 1024) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pied-piper-test-'));
  roots.push(tempRoot);
  const app = buildApp({ tempRoot, maxFileBytes, runWorker: async () => result });
  await app.ready();
  return { app, tempRoot };
}

function multipart(content: Buffer, fileName = 'song.wav'): { headers: Record<string, string>; payload: Buffer } {
  const boundary = 'pied-piper-boundary';
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${fileName}"\r\nContent-Type: audio/wav\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { headers: { 'content-type': `multipart/form-data; boundary=${boundary}` }, payload: Buffer.concat([head, content, tail]) };
}

test('returns a contract-shaped result and removes the staged file', async () => {
  const { app, tempRoot } = await fixture();
  const body = multipart(Buffer.from('fake audio handled by injected worker'));
  const response = await app.inject({ method: 'POST', url: '/api/transcriptions', ...body });
  assert.equal(response.statusCode, 200);
  assert.equal(response.json().notes[0].tab.label, '1B');
  assert.deepEqual(await readdir(tempRoot), []);
  await app.close();
});

test('rejects a multipart file over the configured byte limit and cleans it up', async () => {
  const { app, tempRoot } = await fixture(8);
  const body = multipart(Buffer.alloc(32, 7));
  const response = await app.inject({ method: 'POST', url: '/api/transcriptions', ...body });
  assert.equal(response.statusCode, 413);
  assert.equal(response.json().code, 'FILE_TOO_LARGE');
  assert.deepEqual(await readdir(tempRoot), []);
  await app.close();
});

test('returns an actionable malformed multipart error', async () => {
  const { app } = await fixture();
  const response = await app.inject({ method: 'POST', url: '/api/transcriptions', payload: 'not multipart' });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().code, 'INVALID_MULTIPART');
  await app.close();
});

test('removes the temporary submission when the worker fails', async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'pied-piper-test-'));
  roots.push(tempRoot);
  const app = buildApp({
    tempRoot,
    runWorker: async () => { throw new WorkerError('INVALID_AUDIO', 422, 'The file could not be decoded as usable audio.'); },
  });
  await app.ready();
  const body = multipart(Buffer.from('invalid data'));
  const response = await app.inject({ method: 'POST', url: '/api/transcriptions', ...body });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().code, 'INVALID_AUDIO');
  assert.deepEqual(await readdir(tempRoot), []);
  await app.close();
});
