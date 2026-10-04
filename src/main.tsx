import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './i18n';
import './index.css';

// 注销旧的Service Worker，避免缓存旧页面
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
        console.log('[main] Service Worker unregistered:', registration.scope);
      });
    })
    .catch((err) => {
      console.warn('[main] Service Worker unregister failed:', err);
    });
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// 注意：不使用 StrictMode。
// PlayCanvas 引擎初始化昂贵且非幂等，StrictMode 的双重挂载会导致引擎被 cleanup 销毁后无法重建。
createRoot(root).render(<App />);
