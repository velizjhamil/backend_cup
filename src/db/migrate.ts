import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import 'dotenv/config';

// Usamos la misma conexión directa que probaste hace rato y sí funcionó
const sql = postgres(process.env.DATABASE_URL as string, { max: 1 });
const db = drizzle(sql);

async function main() {
    console.log('🚀 Iniciando migración de la base de datos...');
    try {
        await migrate(db, { migrationsFolder: './src/db/migrations' });
        console.log('✅ ¡Migración completada con éxito! Las tablas ya están en Postgres.');
    } catch (error) {
        console.error('❌ Error al migrar:', error);
    } finally {
        await sql.end();
        process.exit(0);
    }
}

main();