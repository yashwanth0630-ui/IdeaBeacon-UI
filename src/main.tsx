import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress stray WebSocket HMR rejections in cloud iframe environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (reason.includes('WebSocket') || reason.includes('websocket') || reason.includes('[vite]')) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
