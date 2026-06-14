import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ReferenceDataProvider } from './data/referenceStore';
import { initMonitoring } from './lib/monitoring';
import './styles/wireframe.css';

// Error + unhandled-rejection monitoring (no-op without VITE_SENTRY_DSN).
void initMonitoring();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary variant="app">
      <ReferenceDataProvider>
        <App />
      </ReferenceDataProvider>
    </ErrorBoundary>
  </StrictMode>,
);
