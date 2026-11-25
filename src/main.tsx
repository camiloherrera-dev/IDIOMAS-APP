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

// tras un despliegue nuevo, una pestaña abierta puede pedir trozos que ya no existen: se recarga una vez.
// Si el error llega porque la página se está yendo (el navegador corta sus cargas), no se hace nada.
let leaving = false;
window.addEventListener('pagehide', () => (leaving = true));
window.addEventListener('vite:preloadError', (event) => {
  if (leaving) return;
  const KEY = 'lingo-reloaded-at';
  const last = Number(sessionStorage.getItem(KEY) ?? 0);
  if (Date.now() - last < 30_000) return; // ya se intentó: no entrar en un ciclo
  event.preventDefault();
  setTimeout(() => {
    if (leaving) return;
    sessionStorage.setItem(KEY, String(Date.now()));
    window.location.reload();
  }, 600);
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
