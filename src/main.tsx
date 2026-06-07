import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DataProvider } from './data/store';
import './styles/wireframe.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </StrictMode>,
);
