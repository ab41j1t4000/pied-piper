import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_SECONDS = 90;
const DURATION_PROBE_TIMEOUT_MS = 3_000;
const ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,.webm,.opus,audio/*';

interface Props {
  busy: boolean;
  onSubmit: (audio: Blob, filename: string) => void;
}

export function TranscriptionUpload({ busy, onSubmit }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const durationProbe = useRef<HTMLAudioElement | null>(null);
  const durationProbeUrl = useRef<string | null>(null);
  const durationProbeTimer = useRef<number | undefined>(undefined);
  const [error, setError] = useState('');
  const [checkingDuration, setCheckingDuration] = useState(false);

  const clearDurationProbe = useCallback(() => {
    window.clearTimeout(durationProbeTimer.current);
    durationProbeTimer.current = undefined;
    if (durationProbe.current) {
      durationProbe.current.onloadedmetadata = null;
      durationProbe.current.onerror = null;
      durationProbe.current.pause();
      durationProbe.current.removeAttribute('src');
      durationProbe.current = null;
    }
    if (durationProbeUrl.current) URL.revokeObjectURL(durationProbeUrl.current);
    durationProbeUrl.current = null;
  }, []);

  useEffect(() => () => clearDurationProbe(), [clearDurationProbe]);

  const handleFile = (file?: File) => {
    setError('');
    if (!file) return;
    if (file.size === 0) {
      setError('This file is empty. Choose another audio file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That file is larger than 50 MiB. Choose a smaller recording.');
      return;
    }
    setCheckingDuration(true);

    let probe: HTMLAudioElement;
    try {
      durationProbeUrl.current = URL.createObjectURL(file);
      probe = new Audio();
      durationProbe.current = probe;
    } catch {
      clearDurationProbe();
      setCheckingDuration(false);
      onSubmit(file, file.name || 'recording.audio');
      return;
    }

    const finish = (duration?: number) => {
      if (durationProbe.current !== probe) return;
      clearDurationProbe();
      setCheckingDuration(false);
      if (typeof duration === 'number' && Number.isFinite(duration) && duration > MAX_AUDIO_SECONDS) {
        setError('This audio is longer than 1 minute 30 seconds. Choose a shorter recording.');
        return;
      }
      onSubmit(file, file.name || 'recording.audio');
    };

    probe.preload = 'metadata';
    probe.onloadedmetadata = () => finish(probe.duration);
    probe.onerror = () => finish();
    durationProbeTimer.current = window.setTimeout(() => finish(), DURATION_PROBE_TIMEOUT_MS);
    probe.src = durationProbeUrl.current;
    probe.load();
  };

  return (
    <section className="input-panel" aria-labelledby="upload-heading">
      <div className="panel-icon" aria-hidden="true">↥</div>
      <div>
        <h2 id="upload-heading">Choose an audio file</h2>
        <p>MP3, WAV, M4A/AAC, OGG, FLAC, or a supported browser recording.</p>
        <p className="quiet-note">Up to 1:30 · 50 MiB maximum</p>
        <input
          ref={input}
          className="visually-hidden"
          type="file"
          accept={ACCEPT}
          aria-label="Audio file"
          disabled={busy || checkingDuration}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            handleFile(file);
          }}
        />
        <button className="button button-dark" type="button" disabled={busy || checkingDuration} onClick={() => input.current?.click()}>
          {checkingDuration ? 'Checking duration…' : busy ? 'Working…' : 'Browse files'}
        </button>
        {checkingDuration && <p className="quiet-note" role="status">Checking the audio duration. The server will verify it during processing.</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
