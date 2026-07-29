import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import { initSentryClient } from './lib/sentry';
import { initPostHog } from './lib/posthog';
import { inject as injectAnalytics } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './index.css';

// Fire-and-forget: si las env vars no estan definidas es no-op.
void initSentryClient();
void initPostHog();

// Vercel Analytics + Speed Insights (auto-detectan entorno, no-op en dev).
injectAnalytics();
injectSpeedInsights();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
