import type { TranscriptionResult as Result } from './types';

interface Props {
  result: Result;
  audioUrl: string;
  filename: string;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remainder}`;
}

export function TranscriptionResult({ result, audioUrl, filename }: Props) {
  return (
    <section className="result-card" aria-labelledby="result-heading">
      <div className="result-header">
        <div>
          <p className="eyebrow">YOUR MELODY MAP</p>
          <h2 id="result-heading">Chromatic harmonica tab</h2>
          <p className="result-subtitle">{filename} <span>·</span> {result.notes.length} notes <span>·</span> {formatTime(result.durationSeconds)}</p>
        </div>
        <span className={`result-badge ${result.resultStatus}`}>{result.resultStatus === 'partial' ? 'Partial result' : 'Ready to review'}</span>
      </div>

      <div className="tuning-strip">
        <div><span className="strip-label">INSTRUMENT</span><strong>C chromatic · 12 holes</strong></div>
        <div><span className="strip-label">TAB KEY</span><strong>B = blow · D = draw · + = slide in</strong></div>
      </div>

      {result.warnings.length > 0 && (
        <div className="warning-list" aria-label="Transcription notes">
          {result.warnings.map((warning) => <p key={warning.code}><span aria-hidden="true">!</span>{warning.message}</p>)}
        </div>
      )}

      <div className="audio-review">
        <div className="audio-review-copy"><span className="audio-glyph" aria-hidden="true">♫</span><div><strong>Listen while you check</strong><span>The original audio stays in this page session.</span></div></div>
        <audio controls preload="metadata" src={audioUrl} aria-label="Play submitted audio" />
      </div>

      <div className="notes-heading"><h3>Notes in order</h3><span>Start · duration · detected note · fingering</span></div>
      <ol className="note-list">
        {result.notes.map((note) => (
          <li className={`note-row ${note.confidenceBand}`} key={`${note.sequence}-${note.startSeconds}`}>
            <span className="note-time">{formatTime(note.startSeconds)}</span>
            <span className="note-duration">{note.durationSeconds.toFixed(1)}s</span>
            <span className="note-name">{note.noteName}</span>
            <span className="note-tab">{note.tab?.label ?? '—'}</span>
            <span className={`confidence ${note.confidenceBand}`}>{note.confidenceBand === 'high' ? 'Stronger signal' : 'Needs review'}</span>
            {note.playability === 'out_of_range' && <span className="range-note">Outside range</span>}
          </li>
        ))}
      </ol>
      <p className="confidence-footnote">Signal labels are relative guidance, not a promise of accuracy. Listen to the recording and review marked notes by ear.</p>
    </section>
  );
}
