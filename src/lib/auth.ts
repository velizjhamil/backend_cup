import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../db/index.js';
import { accounts, sessions, users, verifications } from '../db/schema.js';
import { allowedOrigins, env, isGoogleAuthEnabled } from '../config/env.js';

/**
 * Instancia única de Better Auth (docs/SECURITY.md: auth con librería, nunca hash casero).
 * Las tablas viven en src/db/schema.ts y se mapean acá porque en SQL usamos plural.
 */
export const auth = betterAuth({
    appName: 'CUP Simulacro',
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/api/auth',
    // Solo los orígenes del frontend pueden mandar cookies de sesión a esta API.
    trustedOrigins: allowedOrigins,
    database: drizzleAdapter(db, {
        provider: 'pg',
        schema: {
            user: users,
            session: sessions,
            account: accounts,
            verification: verifications,
        },
    }),
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        // Todavía no hay servicio de email: exigir verificación impediría registrarse.
        // Cuando exista SMTP, pasar a true y configurar sendVerificationEmail.
        requireEmailVerification: false,
    },
    // Google se habilita solo con credenciales reales; sin ellas no se ofrece el botón.
    ...(isGoogleAuthEnabled && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
              socialProviders: {
                  google: {
                      clientId: env.GOOGLE_CLIENT_ID,
                      clientSecret: env.GOOGLE_CLIENT_SECRET,
                  },
              },
          }
        : {}),
});

/** Sesión que devuelve Better Auth: `{ user, session }`. */
export type AuthSession = typeof auth.$Infer.Session;
