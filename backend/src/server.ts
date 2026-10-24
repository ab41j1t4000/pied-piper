import { buildApp } from './app.js';
import { cleanupOrphanedAudioWorkdirs } from './services/audio-temp-storage.js';
import { config } from './config.js';

async function start(): Promise<void> {
  await cleanupOrphanedAudioWorkdirs(config.tempRoot);
  const app = buildApp({
    tempRoot: config.tempRoot,
    pythonExecutable: config.pythonExecutable,
    timeoutMs: config.workerTimeoutMs,
    maxFileBytes: config.maxFileBytes,
  });
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

start().catch(() => {
  process.exitCode = 1;
});
