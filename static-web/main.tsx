import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../app/page';
import './globals.css';
import '../app/finance.css';
import '../app/editing.css';
import '../app/feature-hub.css';
import '../app/travel-investments.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
