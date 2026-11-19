import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';
import { buildPostgresOptions } from './connection-options.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL no está definida: no hay a qué base migrar.');
    process.exit(1);
}

// Misma configuración que la API: SSL y `prepare: false` contra Supabase.
const sql = postgres(connectionString, buildPostgresOptions(connectionString, 1));
const db = drizzle(sql);

async function main() {
    console.log('🚀 Iniciando migración de la base de datos...');
    // Código de salida ≠ 0 si falla: el pipeline de deploy debe frenar antes de arrancar la API.
    let exitCode = 0;
    try {
        await migrate(db, { migrationsFolder: './src/db/migrations' });
        console.log('✅ ¡Migración completada con éxito! Las tablas ya están en Postgres.');
    } catch (error) {
        console.error('❌ Error al migrar:', error);
        exitCode = 1;
    } finally {
        await sql.end();
        process.exit(exitCode);
    }
}

main();