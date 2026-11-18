import Fastify, { type FastifyError } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { jsonSchemaTransform, serializerCompiler, validatorCompiler, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { questionsRoutes } from './routes/questions.js';
import { attemptsRoutes } from './routes/attempts.js';
import { statsRoutes } from './routes/stats.js';
import { chatRoutes } from './routes/chat.js';
import { closeDatabaseConnection } from './db/index.js';
import { authPlugin } from './plugins/auth.js';
import { allowedOrigins } from './config/env.js';

/**
 * Construye la aplicación Fastify completa (plugins, handlers y rutas).
 * No llama a `listen`: eso es responsabilidad de src/server.ts, para que
 * scripts (ej. scripts/generate-openapi.ts) y tests puedan importarla sin
 * abrir un puerto.
 */
export const app = Fastify({
    logger: true,
}).withTypeProvider<ZodTypeProvider>();

// Configuración para usar Zod en la validación
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

// Formato de error uniforme para toda la API: { error: { code, message } }
app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
        request.log.error({ err: error }, 'Error no controlado');
        return reply.code(500).send({
            error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor.' },
        });
    }

    if (error.validation) {
        return reply.code(statusCode).send({
            error: { code: 'VALIDATION_ERROR', message: error.message },
        });
    }

    return reply.code(statusCode).send({
        error: { code: error.code ?? 'REQUEST_ERROR', message: error.message },
    });
});

app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${request.method} ${request.url}` },
    });
});

// Plugins
// CORS solo para los orígenes permitidos del frontend (docs/SECURITY.md) y con cookies de sesión.
// La función evita que se anuncie este origen a un Origin ajeno: sin coincidencia
// no se manda `Access-Control-Allow-Origin` y el navegador bloquea la respuesta.
app.register(cors, {
    origin: (origin, callback) => {
        // Sin Origin (curl, server-to-server, proxy same-origin): se permite.
        if (!origin) {
            callback(null, true);
            return;
        }
        callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
});

// Añade `request.authSession` a todos los requests (lo llena requireAuth).
app.decorateRequest('authSession', null);

// Better Auth: /api/auth/* (registro, login, sesión, Google OAuth).
app.register(authPlugin);

// Configuración de Swagger (Documentación autogenerada)
app.register(swagger, {
    openapi: {
        info: {
            title: 'API CUP Simulacro',
            description: 'Documentación automática de la API',
            version: '1.0.0',
        },
    },
    // Convierte los esquemas Zod a JSON Schema para que /docs muestre la API real
    transform: jsonSchemaTransform,
});
app.register(swaggerUi, {
    routePrefix: '/docs',
});

// Rutas de la aplicación
app.register(questionsRoutes);
app.register(attemptsRoutes);
app.register(statsRoutes);
app.register(chatRoutes);

// Ruta de prueba (Healthcheck)
app.get('/health', {
    schema: {
        response: {
            200: z.object({
                status: z.string(),
                message: z.string(),
            }),
        },
    },
}, async () => {
    return { status: 'ok', message: '¡El backend de la FICCT está vivo!' };
});

// Cierra el pool de conexiones cuando la aplicación se cierra
app.addHook('onClose', async () => {
    await closeDatabaseConnection();
});
