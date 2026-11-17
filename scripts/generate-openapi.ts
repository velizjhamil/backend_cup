import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { app } from '../src/app.js';

/**
 * Genera `openapi.json` en la raíz del backend a partir de los esquemas Zod.
 * Ese archivo es el contrato que consume frontend_cup (`pnpm gen:api`).
 */
const outputPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json');

const generate = async () => {
    try {
        await app.ready();
        const spec = app.swagger();
        await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
        console.log(`✅ openapi.json generado en ${outputPath}`);
    } catch (error) {
        console.error('❌ No se pudo generar openapi.json:', error);
        process.exitCode = 1;
    } finally {
        await app.close();
    }
};

await generate();
