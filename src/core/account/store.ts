/** estado de la cuenta, sin dependencias pesadas (lo importan pantallas del bundle inicial) */
import { create } from 'zustand';

export interface AccountUser {
  id: string;
  name: string;
  email: string;
}

export type AccountStatus = 'loading' | 'unavailable' | 'signedOut' | 'signedIn' | 'conflict';

interface AccountStore {
  status: AccountStatus;
  user: AccountUser | null;
  /** el servidor ofrece "Continuar con Google" */
  google: boolean;
  /** sin conexión: se muestra la cuenta guardada y se sincroniza al volver */
  offline: boolean;
}

export const useAccount = create<AccountStore>(() => ({ status: 'loading', user: null, google: false, offline: false }));
