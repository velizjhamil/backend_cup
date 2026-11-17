import 'dotenv/config';
import { z } from 'zod';

/**
 * Variables de entorno validadas con Zod (ver docs/DEPLOY.md).
 * Si falta una obligatoria o tiene formato inválido, la app falla al arrancar:
 * es mejor eso que descubrirlo en el primer request de un usuario.
 */
const envSchema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria.'),
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().min(1).default('0.0.0.0'),
    FRONTEND_URL: z.url().default('http://localhost:5173'),
    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET necesita al menos 32 caracteres.'),
    BETTER_AUTH_URL: z.url().default('http://localhost:4000'),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const detalle = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');

    throw new Error(`Configuración inválida en .env:\n${detalle}`);
}

export const env = parsed.data;

/**
 * Orígenes permitidos para CORS y trustedOrigins de Better Auth.
 * Incluye `FRONTEND_URL` más los puertos locales habituales de Vite en desarrollo
 * por si `:5173` está ocupado o se accede por `127.0.0.1`.
 */
export const allowedOrigins = Array.from(
    new Set([
        env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:5174',
    ]),
);

/**
 * Google OAuth solo se habilita si están las dos credenciales.
 * Sin ellas el resto del auth (email + contraseña) funciona igual.
 */
export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
