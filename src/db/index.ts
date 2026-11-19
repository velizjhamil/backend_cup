import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { buildPostgresOptions } from './connection-options.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL no está definida. Revisa el archivo .env.');
}

// Pool único de conexiones para toda la aplicación (SSL + sin prepared
// statements en producción/Supabase, ver connection-options.ts).
export const queryClient = postgres(connectionString, buildPostgresOptions(connectionString, 10));

// Cliente de Drizzle tipado que usan las rutas.
export const db = drizzle(queryClient);

// Libera el pool cuando Fastify se cierra.
export async function closeDatabaseConnection(): Promise<void> {
    await queryClient.end({ timeout: 5 });
}
