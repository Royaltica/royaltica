import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
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

// Cliente de datos remotos (TanStack Query). staleTime alto porque la mayoria
// de las vistas ya refrescan manualmente tras mutaciones; esto evita refetch
// agresivo en focus/reconnect mientras se migra el resto de las vistas.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
