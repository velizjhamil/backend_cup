import type { Options } from 'postgres';

/**
 * Opciones de `postgres-js` compartidas por la API, las migraciones y el seed.
 *
 * - SSL (`ssl: 'require'`): obligatorio contra Supabase. Se activa en
 *   producción y también cuando `DATABASE_URL` apunta a Supabase, para que
 *   `pnpm db:migrate` / `pnpm db:seed` corridos desde una máquina local
 *   contra Supabase funcionen sin cambiar `NODE_ENV`.
 * - `prepare: false`: el pooler de Supabase en modo transacción (puerto 6543,
 *   Supavisor) no soporta prepared statements con nombre; sin esto aparecen
 *   errores tipo `prepared statement "..." does not exist`.
 *
 * En local (Docker, sin SSL) no se toca nada.
 */
export function buildPostgresOptions(
    connectionString: string,
    max: number,
): Options<Record<string, never>> {
    const isProduction = process.env.NODE_ENV === 'production';
    const isSupabase = isSupabaseUrl(connectionString);

    if (!isProduction && !isSupabase) {
        return { max };
    }

    return { max, ssl: 'require', prepare: false };
}

function isSupabaseUrl(connectionString: string): boolean {
    try {
        const { hostname } = new URL(connectionString);
        return hostname.endsWith('.supabase.co') || hostname.endsWith('.supabase.com');
    } catch {
        return false;
    }
}
