import React from 'react';
import ReactDOM from 'react-dom/client';
import { TranscriptionPage } from './features/transcription/TranscriptionPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TranscriptionPage />
  </React.StrictMode>,
);
