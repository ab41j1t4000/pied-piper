import { useCallback, useEffect, useRef, useState } from 'react';

export type CaptureStatus = 'idle' | 'recording' | 'ready' | 'error';

const LIMIT_MS = 90_000;
const FORMATS = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'] as const;

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'NotAllowedError') return 'Microphone access was denied. You can upload an audio file instead.';
  if (error instanceof DOMException && error.name === 'NotFoundError') return 'No microphone was found. You can upload an audio file instead.';
  if (error instanceof DOMException && error.name === 'NotReadableError') return 'The microphone is being used by another app. You can upload an audio file instead.';
  return 'This browser could not start a recording. You can upload an audio file instead.';
}

export function useAudioCapture(onLimit?: () => void) {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [audio, setAudio] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | undefined>(undefined);
  const clockRef = useRef<number | undefined>(undefined);

  const releaseTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopClock = useCallback(() => {
    window.clearTimeout(timerRef.current);
    window.clearInterval(clockRef.current);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setAudio(null);
    setError('');
    setSeconds(0);
    setStatus('idle');
    stopClock();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    else releaseTracks();
  }, [releaseTracks, stopClock]);

  const start = useCallback(async () => {
    setError('');
    setAudio(null);
    setSeconds(0);
    cancelledRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser does not support microphone recording. You can upload an audio file instead.');
      setStatus('error');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = FORMATS.find((format) => MediaRecorder.isTypeSupported(format));
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onerror = () => {
        cancelledRef.current = true;
        setError('The recording stopped unexpectedly. You can try again or upload a file.');
        setStatus('error');
        releaseTracks();
        stopClock();
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        chunksRef.current = [];
        releaseTracks();
        stopClock();
        if (cancelledRef.current) return;
        if (blob.size > 0) {
          setAudio(blob);
          setStatus('ready');
        } else {
          setError('No audio was captured. Check your microphone and try again.');
          setStatus('error');
        }
      };
      recorder.start(250);
      setStatus('recording');
      clockRef.current = window.setInterval(() => setSeconds(Math.min(90, Math.floor((Date.now() - startedAtRef.current) / 1000))), 250);
      timerRef.current = window.setTimeout(() => {
        stop();
        onLimit?.();
      }, LIMIT_MS);
    } catch (cause) {
      releaseTracks();
      setError(errorMessage(cause));
      setStatus('error');
    }
  }, [onLimit, releaseTracks, stop, stopClock]);

  useEffect(() => () => {
    cancelledRef.current = true;
    stopClock();
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    releaseTracks();
  }, [releaseTracks, stopClock]);

  return { status, audio, seconds, error, start, stop, cancel, discard: cancel };
}
