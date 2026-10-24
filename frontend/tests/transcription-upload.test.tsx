import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranscriptionUpload } from '../src/features/transcription/TranscriptionUpload';

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

function mockAudioProbe(duration: number) {
  const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:duration-probe') });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  vi.stubGlobal('Audio', class {
    onloadedmetadata: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;
    preload = '';
    duration = duration;
    set src(_value: string) {
      queueMicrotask(() => this.onloadedmetadata?.(new Event('loadedmetadata')));
    }
    load() {}
    pause() {}
    removeAttribute() {}
  });
  return { revoke };
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
  else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
  else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('TranscriptionUpload', () => {
  it('checks metadata and submits a file within the duration limit', async () => {
    mockAudioProbe(84);
    const onSubmit = vi.fn();
    render(<TranscriptionUpload busy={false} onSubmit={onSubmit} />);
    const file = new File(['audio'], 'melody.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Audio file'), { target: { files: [file] } });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(file, 'melody.wav'));
  });

  it('explains over-limit duration before submitting the file', async () => {
    const { revoke } = mockAudioProbe(90.1);
    const onSubmit = vi.fn();
    render(<TranscriptionUpload busy={false} onSubmit={onSubmit} />);
    const file = new File(['audio'], 'long.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByLabelText('Audio file'), { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('longer than 1 minute 30 seconds');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:duration-probe');
  });

  it('does not submit an empty file and explains the problem', () => {
    const onSubmit = vi.fn();
    render(<TranscriptionUpload busy={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('Audio file'), { target: { files: [new File([], 'empty.wav')] } });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('file is empty');
  });

  it('disables file selection while processing', () => {
    render(<TranscriptionUpload busy onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
  });
});
