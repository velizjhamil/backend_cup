import type { FastifyReply, FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth, type AuthSession } from '../../lib/auth.js';

declare module 'fastify' {
    interface FastifyRequest {
        /** Sesión resuelta por `requireAuth`; `null` en rutas públicas. */
        authSession: AuthSession | null;
    }
}

/** Lee la sesión desde la cookie httpOnly del request. */
export function getSession(request: FastifyRequest): Promise<AuthSession | null> {
    return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

/**
 * Middleware para rutas protegidas: responde 401 con el formato de error uniforme.
 * Deja la sesión en `request.authSession` para que el handler no repita la consulta.
 *
 * Uso: `app.get('/api/attempts', { preHandler: requireAuth }, handler)`.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const session = await getSession(request);

    if (!session) {
        await reply.code(401).send({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Necesitás iniciar sesión para continuar.',
            },
        });
        return;
    }

    request.authSession = session;
}
