import 'dotenv/config';
import { z } from 'zod';

/**
 * Variables de entorno validadas con Zod (ver docs/DEPLOY.md).
 * Si falta una obligatoria o tiene formato inválido, la app falla al arrancar:
 * es mejor eso que descubrirlo en el primer request de un usuario.
 */
const isLocalhostUrl = (value: string): boolean => {
    const { hostname } = new URL(value);
    return hostname === 'localhost' || hostname === '127.0.0.1';
};

// CORS compara strings exactos contra el header Origin, que nunca lleva barra final ni path.
const toOrigin = (value: string): string => new URL(value).origin;

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria.'),
    // Los hosts (Railway, Render, Fly) inyectan PORT; 4000 es solo el default local.
    PORT: z.coerce.number().int().positive().default(4000),
    HOST: z.string().min(1).default('0.0.0.0'),
    FRONTEND_URL: z.url().default('http://localhost:5173').transform(toOrigin),
    // Orígenes extra separados por coma (ej. dominio propio + URL de Vercel).
    CORS_ORIGINS: z
        .string()
        .optional()
        .transform((value) =>
            value
                ? value
                      .split(',')
                      .map((origin) => origin.trim())
                      .filter((origin) => origin.length > 0)
                : [],
        )
        .pipe(
            z.array(
                z.url('Cada entrada de CORS_ORIGINS debe ser una URL completa (https://...).').transform(toOrigin),
            ),
        ),
    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET necesita al menos 32 caracteres.'),
    BETTER_AUTH_URL: z.url().default('http://localhost:4000'),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GEMINI_API_KEY: z.string().trim().optional(),
    GEMINI_MODEL: z.string().trim().min(1).default('gemini-2.5-flash'),
    // Used after GEMINI_MODEL fails (503/429/timeout/404). A "lite" model: lower demand, ~2 s to first chunk.
    GEMINI_FALLBACK_MODEL: z.string().trim().min(1).default('gemini-3.1-flash-lite'),
    AI_DAILY_LIMIT_USER: z.coerce.number().int().positive().default(30),
    AI_DAILY_LIMIT_GUEST: z.coerce.number().int().positive().default(5),
}).superRefine((value, ctx) => {
    if (value.NODE_ENV !== 'production') return;

    // Los defaults apuntan a localhost: en producción romperían cookies y CORS sin error visible,
    // y sin https Better Auth no puede emitir cookies `Secure`.
    const publicUrlIssue = (url: string): string | null => {
        if (isLocalhostUrl(url)) return 'apunta a localhost; en producción definí el dominio público real.';
        if (new URL(url).protocol !== 'https:') return 'debe usar https en producción.';
        return null;
    };

    for (const key of ['FRONTEND_URL', 'BETTER_AUTH_URL'] as const) {
        const issue = publicUrlIssue(value[key]);
        if (issue) ctx.addIssue({ code: 'custom', path: [key], message: `${key} ${issue}` });
    }

    value.CORS_ORIGINS.forEach((origin, index) => {
        const issue = publicUrlIssue(origin);
        if (issue) ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS', index], message: `${origin} ${issue}` });
    });
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    const detalle = parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n');

    throw new Error(`Configuración inválida en .env:\n${detalle}`);
}

export const env = parsed.data;

const LOCAL_DEV_ORIGINS = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];

/**
 * Orígenes permitidos para CORS y trustedOrigins de Better Auth:
 * `FRONTEND_URL` + `CORS_ORIGINS`. Los puertos locales de Vite solo se suman
 * fuera de producción, para que ninguna página servida en localhost pueda
 * mandar requests con cookies a la API real.
 */
export const allowedOrigins = Array.from(
    new Set([
        env.FRONTEND_URL,
        ...env.CORS_ORIGINS,
        ...(env.NODE_ENV === 'production' ? [] : LOCAL_DEV_ORIGINS),
    ]),
);

/**
 * Google OAuth solo se habilita si están las dos credenciales.
 * Sin ellas el resto del auth (email + contraseña) funciona igual.
 */
export const isGoogleAuthEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

/** Indica si hay una clave válida configurada para llamar a la API de Gemini. */
export const isGeminiEnabled = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 0);
