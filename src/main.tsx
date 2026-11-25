import '@fontsource-variable/plus-jakarta-sans';
import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { unlockSpeechOnFirstGesture } from './core/audio';
import { startAutoSync } from './db/sync';

registerSW({ immediate: true });

// tras un despliegue nuevo, una pestaña abierta puede pedir trozos que ya no existen: se recarga una vez
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'lingo-reloaded-at';
  const last = Number(sessionStorage.getItem(KEY) ?? 0);
  if (Date.now() - last < 30_000) return; // ya se intentó: no entrar en un ciclo
  sessionStorage.setItem(KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});
// iOS solo deja hablar tras un gesto: el primer toque desbloquea la voz para toda la sesión
unlockSpeechOnFirstGesture();
startAutoSync();
// la cuenta (y su cliente) se carga aparte para no pesar en el arranque
void import('./core/account').then((m) => m.initAccount());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
