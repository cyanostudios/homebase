import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import { ErrorBoundary } from '@/core/ui/ErrorBoundary';

import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
