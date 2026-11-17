import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL no está definida. Revisa el archivo .env.');
}

// Pool único de conexiones para toda la aplicación.
export const queryClient = postgres(connectionString, { max: 10 });

// Cliente de Drizzle tipado que usan las rutas.
export const db = drizzle(queryClient);

// Libera el pool cuando Fastify se cierra.
export async function closeDatabaseConnection(): Promise<void> {
    await queryClient.end({ timeout: 5 });
}
