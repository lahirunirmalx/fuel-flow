import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { migrateLegacyLocalStorageToCookies } from './migrateLegacyStorage';
import App from './App.tsx';
import './index.css';

migrateLegacyLocalStorageToCookies();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
