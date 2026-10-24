import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const config = {
  port: Number(process.env.PORT ?? 3001),
  pythonExecutable: process.env.PYTHON_EXECUTABLE ?? path.join(repoRoot, '.venv/bin/python'),
  workerTimeoutMs: 120_000,
  tempRoot: path.resolve(process.env.AUDIO_TEMP_ROOT ?? path.join(repoRoot, '.pied-piper-tmp')),
  maxFileBytes: 50 * 1024 * 1024,
  maxDurationSeconds: 90,
};
