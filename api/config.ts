/** qué ofrece este servidor; la app lo consulta para mostrar u ocultar las cuentas */
import { accountsEnabled, googleEnabled } from './_lib/auth.js';
import { json } from './_lib/http.js';

export function GET() {
  return json(
    200,
    { accounts: accountsEnabled(), google: accountsEnabled() && googleEnabled() },
    { 'Cache-Control': 'public, max-age=60' },
  );
}
