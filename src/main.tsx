import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Register the Web Push service worker for background push notifications.
// The SW listens for push events and shows native browser notifications
// even when the app tab is closed or in the background.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.info('[SW] sw.js registered:', registration.scope);
      })
      .catch((err) => {
        console.warn('[SW] Service worker registration failed:', err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
