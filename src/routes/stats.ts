import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { consumeAiQuota, generateStudyRecommendations } from '../lib/ai-tutor.js';
import { getWeakPointsData } from '../lib/weak-points.js';
import { requireAuth } from '../modules/auth/guards.js';
import { apiErrorSchema } from '../schemas/common.schema.js';
import { recommendationsResponseSchema, weakPointsResponseSchema } from '../schemas/stats.schema.js';

export const statsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.get('/api/stats/weak-points', {
        preHandler: requireAuth,
        schema: {
            tags: ['stats'],
            summary: 'Puntos débiles por tema y pregunta del usuario autenticado',
            description:
                'Agrupa todas las respuestas históricas en `attempt_answers` para detectar los temas y preguntas con mayor porcentaje y frecuencia de error.',
            response: {
                200: weakPointsResponseSchema,
                401: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const userId = request.authSession!.user.id;
            const data = await getWeakPointsData(userId);

            return reply.code(200).send({ data });
        } catch (error) {
            request.log.error({ err: error }, 'Error al calcular los puntos débiles');

            return reply.code(500).send({
                error: {
                    code: 'WEAK_POINTS_FETCH_FAILED',
                    message: 'No se pudieron calcular tus puntos débiles.',
                },
            });
        }
    });

    app.post('/api/stats/recommendations', {
        preHandler: requireAuth,
        schema: {
            tags: ['stats'],
            summary: 'Recomendaciones de estudio generadas por IA a partir de los puntos débiles',
            description:
                'Reutiliza el cálculo de `/api/stats/weak-points` y pide a Gemini hasta 3 consejos de estudio accionables en Markdown. Si el usuario no tiene suficiente historial, devuelve `hasEnoughData: false` sin consumir cuota de IA.',
            response: {
                200: recommendationsResponseSchema,
                401: apiErrorSchema,
                429: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const userId = request.authSession!.user.id;
            const weakPoints = await getWeakPointsData(userId);

            if (weakPoints.totalWrongAnswers === 0) {
                return reply.code(200).send({
                    data: {
                        recommendationsMd:
                            weakPoints.totalAnswersAnalyzed === 0
                                ? 'Todavía no registramos simulacros guardados en tu cuenta. Rendí al menos un simulacro para que la IA pueda armarte un plan de estudio personalizado.'
                                : '¡Excelente! No registrás errores en tus intentos guardados, así que no hay puntos débiles para reforzar por ahora. Seguí practicando para mantener el nivel.',
                        hasEnoughData: false,
                    },
                });
            }

            const quotaResult = consumeAiQuota(`user:${userId}`, true);
            if (!quotaResult.allowed) {
                return reply.code(429).send({
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: quotaResult.message,
                    },
                });
            }

            const recommendationsMd = await generateStudyRecommendations(weakPoints);

            return reply.code(200).send({
                data: { recommendationsMd, hasEnoughData: true },
            });
        } catch (error) {
            request.log.error({ err: error }, 'Error al generar recomendaciones de estudio con IA');

            return reply.code(500).send({
                error: {
                    code: 'RECOMMENDATIONS_GENERATION_FAILED',
                    message: 'No se pudo generar tu plan de estudio en este momento.',
                },
            });
        }
    });
};
