import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
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
