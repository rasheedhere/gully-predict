import { useState, useEffect } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISSED_KEY = 'pwa_banner_dismissed';

export default function PWAInstallBanner() {
  const { canInstall, isInstalled, installApp, isIOS } = usePWAInstall();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isInstalled) return;
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (canInstall) {
      // Small delay so it doesn't pop up immediately on load
      const t = setTimeout(() => setVisible(true), 5000);
      return () => clearTimeout(t);
    }
  }, [canInstall, isInstalled]);

  const handleInstall = async () => {
    setInstalling(true);
    const accepted = await installApp();
    if (!accepted) setInstalling(false);
    setVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="banner"
      aria-label="Install Gully Predict app"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9000,
        padding: `0 16px calc(env(safe-area-inset-bottom) + 72px)`,
        animation: 'pwa-slide-up 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <style>{`
        @keyframes pwa-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(135deg, #1a0a3e 0%, #0d1b3e 60%, #0a1628 100%)',
        border: '1px solid rgba(134, 59, 255, 0.4)',
        borderRadius: '20px',
        padding: '16px 20px',
        boxShadow: '0 -4px 40px rgba(134, 59, 255, 0.25), 0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
      }}>
        {/* Icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #863bff, #4a1a8a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 16px rgba(134, 59, 255, 0.5)',
        }}>
          <img src="/pwa-192x192.png" alt="" width={36} height={36} style={{ borderRadius: 8 }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.3,
          }}>
            Add to Home Screen
          </p>
          {isIOS ? (
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              Tap <strong>Share ↑</strong> then <strong>"Add to Home Screen"</strong>
            </p>
          ) : (
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              Install for faster access & offline support
            </p>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          {!isIOS && (
            <button
              id="pwa-install-btn"
              onClick={handleInstall}
              disabled={installing}
              style={{
                background: 'linear-gradient(135deg, #863bff, #6020c0)',
                border: 'none',
                borderRadius: '10px',
                padding: '8px 16px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                opacity: installing ? 0.7 : 1,
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 16px rgba(134,59,255,0.4)',
                transition: 'transform 0.1s, opacity 0.2s',
              }}
              onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.95)')}
              onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {installing ? '…' : 'Install'}
            </button>
          )}
          <button
            id="pwa-dismiss-btn"
            onClick={handleDismiss}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
