import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioCapture } from '../src/features/transcription/AudioCapture';

class FakeRecorder {
  static isTypeSupported = vi.fn((type: string) => type.startsWith('audio/webm'));
  static last: FakeRecorder | undefined;
  mimeType: string;
  state = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? 'audio/webm';
    FakeRecorder.last = this;
  }

  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['sample'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function setup() {
  const onSubmit = vi.fn();
  const tracks = [{ stop: vi.fn() }];
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }) },
  });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  render(<AudioCapture busy={false} onSubmit={onSubmit} />);
  return { onSubmit, tracks };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('AudioCapture', () => {
  it('explains denied microphone access and keeps the upload alternative available', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) },
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    render(<AudioCapture busy={false} onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Microphone access was denied');
  });

  it('cancels before submission and releases microphone tracks', async () => {
    const { onSubmit, tracks } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    await waitFor(() => expect(screen.getByText(/Recording ·/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(tracks[0].stop).toHaveBeenCalledOnce();
  });

  it('uses a supported recording MIME type and stops at 90 seconds', async () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const tracks = [{ stop: vi.fn() }];
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => tracks }) },
    });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    render(<AudioCapture busy={false} onSubmit={onSubmit} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(screen.getByText(/Stopped at the 1:30 limit/)).toBeInTheDocument();
    expect(FakeRecorder.last?.mimeType).toBe('audio/webm;codecs=opus');
    expect(tracks[0].stop).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Transcribe recording' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.any(Blob), 'browser-recording.webm');
    expect(FakeRecorder.isTypeSupported).toHaveBeenCalled();
  });

  it('clears the prior limit notice when a new recording starts', async () => {
    vi.useFakeTimers();
    setup();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); });
    expect(screen.getByText(/Recording ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByText('Recording ready · audio/webm;codecs=opus')).toBeInTheDocument();
  });
});
