import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { allowedOrigins } from '../config/env.js';
import { db } from '../db/index.js';
import { questions, subjects } from '../db/schema.js';
import {
    consumeAiQuota,
    getCachedQuestionExplanation,
    setCachedQuestionExplanation,
    streamTextChunks,
    streamTutorResponse,
    type TutorQuestionContext,
} from '../lib/ai-tutor.js';
import { getSession } from '../modules/auth/guards.js';
import { chatRequestBodySchema } from '../schemas/chat.schema.js';
import { apiErrorSchema } from '../schemas/common.schema.js';

function writeSseEvent(replyRaw: NodeJS.WritableStream, payload: Record<string, unknown>): void {
    replyRaw.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export const chatRoutes: FastifyPluginAsyncZod = async (app) => {
    app.post('/api/chat', {
        schema: {
            tags: ['chat'],
            summary: 'Tutor IA CUP con streaming SSE (Gemini)',
            description:
                'Responde consultas pedagógicas paso a paso en formato Server-Sent Events (`text/event-stream`). Si recibe `questionId`, inyecta el contexto oficial de Postgres al System Prompt y reutiliza el caché inicial para ahorrar tokens.',
            body: chatRequestBodySchema,
            response: {
                200: z.string().meta({ description: 'Stream Server-Sent Events (text/event-stream)' }),
                400: apiErrorSchema,
                404: apiErrorSchema,
                429: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        const session = await getSession(request);
        const userId = session?.user?.id ?? null;
        const identityKey = userId ? `user:${userId}` : `ip:${request.ip}`;

        const quotaResult = consumeAiQuota(identityKey, userId !== null);
        if (!quotaResult.allowed) {
            return reply.code(429).send({
                error: {
                    code: 'RATE_LIMIT_EXCEEDED',
                    message: quotaResult.message,
                },
            });
        }

        const { messages, questionId } = request.body;
        let questionContext: TutorQuestionContext | null = null;

        if (questionId) {
            const [row] = await db
                .select({
                    id: questions.id,
                    subjectName: subjects.name,
                    topic: questions.topic,
                    statementMd: questions.statementMd,
                    options: questions.options,
                    correctKey: questions.correctKey,
                    explanationMd: questions.explanationMd,
                    procedureMd: questions.procedureMd,
                })
                .from(questions)
                .innerJoin(subjects, eq(subjects.id, questions.subjectId))
                .where(eq(questions.id, questionId))
                .limit(1);

            if (!row) {
                return reply.code(404).send({
                    error: {
                        code: 'QUESTION_NOT_FOUND',
                        message: `No se encontró la pregunta "${questionId}".`,
                    },
                });
            }

            questionContext = row;
        }

        const origin = request.headers.origin;
        const headers: Record<string, string> = {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        };

        if (origin && allowedOrigins.includes(origin)) {
            headers['Access-Control-Allow-Origin'] = origin;
            headers['Access-Control-Allow-Credentials'] = 'true';
            headers['Vary'] = 'Origin';
        }

        reply.hijack();
        reply.raw.writeHead(200, headers);

        const abortController = new AbortController();
        request.raw.on('close', () => {
            abortController.abort();
        });

        try {
            const isInitialQuestionExplanation =
                Boolean(questionContext) && messages.length === 1 && messages[0]?.role === 'user';
            const cachedExplanation = isInitialQuestionExplanation && questionContext
                ? getCachedQuestionExplanation(questionContext.id)
                : null;

            if (cachedExplanation !== null) {
                for await (const chunk of streamTextChunks(cachedExplanation)) {
                    if (abortController.signal.aborted || reply.raw.writableEnded) break;
                    writeSseEvent(reply.raw, { chunk });
                }

                if (!reply.raw.writableEnded) {
                    writeSseEvent(reply.raw, { done: true, cached: true });
                }
                return;
            }

            let fullResponse = '';
            for await (const chunk of streamTutorResponse({
                messages,
                questionContext,
                signal: abortController.signal,
            })) {
                if (abortController.signal.aborted || reply.raw.writableEnded) break;
                fullResponse += chunk;
                writeSseEvent(reply.raw, { chunk });
            }

            if (isInitialQuestionExplanation && questionContext && fullResponse.trim().length > 0) {
                setCachedQuestionExplanation(questionContext.id, fullResponse);
            }

            if (!reply.raw.writableEnded) {
                writeSseEvent(reply.raw, { done: true, cached: false });
            }
        } catch (error) {
            request.log.error({ err: error }, 'Error durante el streaming del tutor IA');
            if (!reply.raw.writableEnded) {
                writeSseEvent(reply.raw, {
                    error: 'No se pudo completar la explicación en este momento.',
                    done: true,
                    cached: false,
                });
            }
        } finally {
            if (!reply.raw.writableEnded) {
                reply.raw.end();
            }
        }
    });
};
