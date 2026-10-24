import { mkdtemp, readdir, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const PREFIX = 'transcription-';

export async function ensureTempRoot(root: string): Promise<void> {
  await mkdir(root, { recursive: true, mode: 0o700 });
}

export async function createAudioWorkdir(root: string): Promise<string> {
  await ensureTempRoot(root);
  return mkdtemp(path.join(root, PREFIX));
}

export async function removeAudioWorkdir(directory: string, root: string): Promise<void> {
  const resolvedRoot = path.resolve(root);
  const resolvedDirectory = path.resolve(directory);
  if (path.dirname(resolvedDirectory) !== resolvedRoot || !path.basename(resolvedDirectory).startsWith(PREFIX)) {
    throw new Error('Refusing to remove a directory outside the app temporary root');
  }
  await rm(resolvedDirectory, { recursive: true, force: true, maxRetries: 2 });
}

export async function cleanupOrphanedAudioWorkdirs(root: string): Promise<void> {
  await ensureTempRoot(root);
  const entries = await readdir(root, { withFileTypes: true });
  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(PREFIX))
    .map((entry) => removeAudioWorkdir(path.join(root, entry.name), root)));
}

export function defaultTempRoot(): string {
  return path.join(os.tmpdir(), 'pied-piper');
}
