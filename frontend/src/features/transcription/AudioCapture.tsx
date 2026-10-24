import { useCallback, useState } from 'react';
import { useAudioCapture } from './useAudioCapture';

interface Props {
  busy: boolean;
  onSubmit: (audio: Blob, filename: string) => void;
}

export function AudioCapture({ busy, onSubmit }: Props) {
  const [limitReached, setLimitReached] = useState(false);
  const onLimit = useCallback(() => setLimitReached(true), []);
  const capture = useAudioCapture(onLimit);
  const extension = capture.audio?.type.includes('ogg') ? 'ogg' : capture.audio?.type.includes('mp4') ? 'm4a' : 'webm';
  const clock = `${Math.floor(capture.seconds / 60)}:${String(capture.seconds % 60).padStart(2, '0')}`;

  return (
    <section className="input-panel capture-panel" aria-labelledby="capture-heading">
      <div className="panel-icon mic-icon" aria-hidden="true">●</div>
      <div className="capture-copy">
        <h2 id="capture-heading">Record a melody</h2>
        <p>Use your microphone to capture a short passage.</p>
        <p className="quiet-note">Your browser will ask before microphone access starts.</p>
        {capture.status === 'recording' && (
          <div className="recording-state" aria-live="polite"><span className="record-dot" /> Recording · {clock} / 1:30</div>
        )}
        {capture.status === 'ready' && <p className="ready-note">{limitReached ? 'Stopped at the 1:30 limit.' : 'Recording ready'} · {capture.audio?.type || 'browser audio'}</p>}
        {capture.error && <p className="inline-error" role="alert">{capture.error}</p>}
        <div className="capture-actions">
          {capture.status !== 'recording' && capture.status !== 'ready' && (
            <button className="button button-outline" type="button" disabled={busy} onClick={() => {
              setLimitReached(false);
              void capture.start();
            }}>
              Start recording
            </button>
          )}
          {capture.status === 'recording' && <>
            <button className="button button-outline" type="button" onClick={capture.stop}>Stop</button>
            <button className="button button-text" type="button" onClick={capture.cancel}>Cancel</button>
          </>}
          {capture.status === 'ready' && (
            <>
              <button className="button button-dark" type="button" disabled={busy} onClick={() => {
                if (!capture.audio) return;
                onSubmit(capture.audio, `browser-recording.${extension}`);
                capture.discard();
              }}>
                {busy ? 'Working…' : 'Transcribe recording'}
              </button>
              <button className="button button-text" type="button" disabled={busy} onClick={capture.cancel}>Discard</button>
            </>
          )}
          {capture.status === 'error' && <button className="button button-text" type="button" disabled={busy} onClick={capture.cancel}>Dismiss</button>}
        </div>
      </div>
    </section>
  );
}
