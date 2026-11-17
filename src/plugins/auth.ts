import type { FastifyPluginAsync } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';

/**
 * Monta el handler de Better Auth en `/api/auth/*` (sign-up, sign-in, get-session,
 * sign-out, callbacks de Google).
 *
 * Better Auth habla Web Standard Request/Response, así que convertimos el request
 * de Fastify y reenviamos status, headers (incluidas las cookies) y body.
 * Estas rutas no se documentan en Swagger: las define la librería, no nuestro Zod.
 */
export const authPlugin: FastifyPluginAsync = async (app) => {
    app.route({
        method: ['GET', 'POST'],
        url: '/api/auth/*',
        handler: async (request, reply) => {
            try {
                const url = new URL(request.url, `http://${request.headers.host ?? 'localhost'}`);
                const headers = fromNodeHeaders(request.headers);
                const body = request.body === undefined ? undefined : JSON.stringify(request.body);

                const authResponse = await auth.handler(new Request(url.toString(), {
                    method: request.method,
                    headers,
                    ...(body === undefined ? {} : { body }),
                }));

                reply.status(authResponse.status);
                const setCookies = authResponse.headers.getSetCookie();
                if (setCookies.length > 0) {
                    reply.header('set-cookie', setCookies);
                }
                authResponse.headers.forEach((value, key) => {
                    if (key.toLowerCase() === 'set-cookie') return;
                    reply.header(key, value);
                });

                if (authResponse.status >= 400) {
                    request.log.warn(
                        { status: authResponse.status, url: request.url },
                        'Respuesta de error en Better Auth',
                    );
                }

                return reply.send(authResponse.body ? await authResponse.text() : null);
            } catch (error) {
                request.log.error({ err: error }, 'Error en Better Auth');

                return reply.code(500).send({
                    error: {
                        code: 'AUTH_FAILURE',
                        message: 'Error interno de autenticación.',
                    },
                });
            }
        },
    });
};
