import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthProvider';
import { CoupleProvider } from './contexts/CoupleProvider';
import './styles/index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to find the root application element.');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CoupleProvider>
          <App />
        </CoupleProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
