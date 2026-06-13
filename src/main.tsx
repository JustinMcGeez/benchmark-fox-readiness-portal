import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ReferenceDataProvider } from './data/referenceStore';
import './styles/wireframe.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReferenceDataProvider>
      <App />
    </ReferenceDataProvider>
  </StrictMode>,
);
