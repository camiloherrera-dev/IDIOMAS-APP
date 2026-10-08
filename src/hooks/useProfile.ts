import { useLiveQuery } from 'dexie-react-hooks';
import { getProfile } from '@/db';

/** perfil reactivo; undefined mientras carga */
export function useProfile() {
  return useLiveQuery(getProfile, []);
}
