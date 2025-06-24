import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { I18nProvider } from '@lingui/react';
import { router } from './lib/router';
import { i18nInstance } from './lib/i18n';
import './index.css';

const App = () => <RouterProvider router={router} />;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider i18n={i18nInstance}>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
