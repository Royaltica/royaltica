import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { initSentryClient } from './lib/sentry';
import { initPostHog } from './lib/posthog';
import './index.css';

// Fire-and-forget: si las env vars no estan definidas es no-op.
void initSentryClient();
void initPostHog();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
