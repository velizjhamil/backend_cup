import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle toma la MISMA base que la app (`DATABASE_URL` del .env).
 * Antes estaba hardcodeada al puerto 5432 mientras la API usaba 5433.
 */
const url = process.env.DATABASE_URL;

if (!url) {
    throw new Error('DATABASE_URL no está definida: drizzle.config.ts la necesita para conectar.');
}

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'postgresql',
    dbCredentials: { url },
});
