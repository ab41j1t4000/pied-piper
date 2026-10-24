import { useCallback, useEffect, useRef, useState } from 'react';
import { createTranscription, TranscriptionApiError } from '../../lib/api';
import type { TranscriptionResult as Result, ApiError } from './types';
import { TranscriptionUpload } from './TranscriptionUpload';
import { AudioCapture } from './AudioCapture';
import { TranscriptionResult } from './TranscriptionResult';

export function TranscriptionPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [source, setSource] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const currentUrl = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const releaseAudio = useCallback(() => {
    if (currentUrl.current) URL.revokeObjectURL(currentUrl.current);
    currentUrl.current = null;
  }, []);

  const submit = useCallback(async (audio: Blob, filename: string) => {
    releaseAudio();
    setResult(null);
    setSource(null);
    setError(null);
    setBusy(true);
    controller.current?.abort();
    const activeController = new AbortController();
    controller.current = activeController;
    try {
      const transcribed = await createTranscription(audio, filename, activeController.signal);
      const url = URL.createObjectURL(audio);
      currentUrl.current = url;
      setSource({ url, name: filename });
      setResult(transcribed);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      const detail = cause instanceof TranscriptionApiError
        ? cause.detail
        : { code: 'PROCESSING_FAILED', message: 'Something went wrong while analyzing the audio.', retryable: true };
      setError(detail);
    } finally {
      if (controller.current === activeController) setBusy(false);
    }
  }, [releaseAudio]);

  const clearReview = () => {
    releaseAudio();
    setSource(null);
    setResult(null);
    setError(null);
  };

  useEffect(() => () => {
    controller.current?.abort();
    releaseAudio();
  }, [releaseAudio]);

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Pied Piper home"><span className="brand-mark">pp</span><span>pied piper</span></a>
        <span className="topbar-note">A melody learning tool</span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-line" />A NEW WAY TO HEAR THE NOTES</p>
          <h1>Find the melody.<br /><em>Play it your way.</em></h1>
          <p className="hero-description">Bring a short recording. Get a chromatic harmonica tab for its lead melody, ready to check alongside the music.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="harmonica-art"><div className="harp-mouthpiece" /><div className="harp-holes">{Array.from({ length: 8 }, (_, i) => <span key={i} />)}</div><div className="harp-slide" /></div>
          <span className="music-note note-a">♪</span><span className="music-note note-b">♫</span><span className="spark spark-a" /><span className="spark spark-b" />
          <div className="art-caption">C · CHROMATIC</div>
        </div>
      </section>

      <section className="workspace" aria-label="Audio transcription">
        {!result && (
          <>
            <div className="workspace-heading"><div><p className="eyebrow">START WITH SOUND</p><h2>Where should we listen?</h2></div><span className="step-pill"><b>01</b> Add audio</span></div>
            <div className="input-grid">
              <TranscriptionUpload busy={busy} onSubmit={submit} />
              <div className="input-divider"><span>OR</span></div>
              <AudioCapture busy={busy} onSubmit={submit} />
            </div>
            {busy && <div className="processing-state" role="status"><span className="spinner" />Listening for one lead melody… this can take up to two minutes.</div>}
            {error && <div className="api-error" role="alert"><span className="error-mark">!</span><div><strong>We couldn’t make a reliable tab</strong><p>{error.message}</p>{error.retryable && <span className="retry-hint">You can try again with a different recording.</span>}</div></div>}
          </>
        )}
        {result && source && <>
          <div className="review-heading"><div><p className="eyebrow">STEP 02 · REVIEW</p><h2>Listen. Follow. Make it yours.</h2></div><button className="button button-text" type="button" onClick={clearReview}>Clear this review</button></div>
          <TranscriptionResult result={result} audioUrl={source.url} filename={source.name} />
        </>}
      </section>

      <footer className="page-footer"><span>One melody at a time.</span><span>Audio is only kept in your active review and is not saved.</span></footer>
    </main>
  );
}
