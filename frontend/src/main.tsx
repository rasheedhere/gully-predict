import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';

const queryClient = new QueryClient();

// The Client ID is safe to be public. Using Vite env with fallback.
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '259072453775-l584jdpb923a0d99gr54gqjptrlqip3g.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);

// Register service worker (works in both dev and prod)
if ('serviceWorker' in navigator) {
  import('workbox-window').then(({ Workbox }) => {
    const wb = new Workbox('/dev-sw.js?dev-sw', { scope: '/', type: 'module' });

    wb.addEventListener('waiting', () => {
      wb.messageSkipWaiting();
    });

    wb.addEventListener('controlling', () => {
      window.location.reload();
    });

    wb.register().catch(console.error);
  });
}
