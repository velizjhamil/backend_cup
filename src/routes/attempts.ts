import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { attemptAnswers, attempts, questions, subjects } from '../db/schema.js';
import { getSession, requireAuth } from '../modules/auth/guards.js';
import { apiErrorSchema } from '../schemas/common.schema.js';
import {
    attemptDetailParamsSchema,
    attemptHistoryResponseSchema,
    submitAttemptBodySchema,
    submitAttemptResponseSchema,
} from '../schemas/attempt.schema.js';

function parseTimestamp(value: number | string | undefined, fallback: Date): Date {
    if (value === undefined) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function roundPercentage(correct: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((correct / total) * 10000) / 100;
}

type SubjectStatItem = {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    total: number;
    correct: number;
};

/**
 * Agrupa resultados corregidos por materia y calcula el porcentaje de acierto por bloque.
 */
function buildSubjectBreakdown(
    items: readonly {
        subjectId: string;
        subjectCode: string;
        subjectName: string;
        isCorrect: boolean;
    }[],
) {
    const stats = new Map<string, SubjectStatItem>();

    for (const item of items) {
        const current = stats.get(item.subjectId) ?? {
            subjectId: item.subjectId,
            subjectCode: item.subjectCode,
            subjectName: item.subjectName,
            total: 0,
            correct: 0,
        };
        current.total += 1;
        if (item.isCorrect) {
            current.correct += 1;
        }
        stats.set(item.subjectId, current);
    }

    return Array.from(stats.values())
        .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode))
        .map((item) => ({
            ...item,
            percentage: roundPercentage(item.correct, item.total),
        }));
}

export const attemptsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.post('/api/attempts/submit', {
        schema: {
            tags: ['attempts'],
            summary: 'Envía respuestas del simulacro y calcula el puntaje en el servidor',
            description:
                'Cruza las respuestas contra `correct_key` en Postgres, guarda el intento y devuelve el desglose total, por materia y por pregunta.',
            body: submitAttemptBodySchema,
            response: {
                200: submitAttemptResponseSchema,
                400: apiErrorSchema,
                404: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        const { answers, questionIds, startTime, endTime } = request.body;

        const targetIds = Array.from(
            new Set([...(questionIds ?? []), ...Object.keys(answers)]),
        ).filter((id) => id.trim().length > 0);

        if (targetIds.length === 0) {
            return reply.code(400).send({
                error: {
                    code: 'EMPTY_ATTEMPT',
                    message: 'El intento debe incluir al menos una pregunta o respuesta.',
                },
            });
        }

        try {
            const session = await getSession(request);
            const userId = session?.user?.id ?? null;

            const rows = await db
                .select({
                    id: questions.id,
                    subjectId: questions.subjectId,
                    subjectCode: subjects.code,
                    subjectName: subjects.name,
                    topic: questions.topic,
                    statementMd: questions.statementMd,
                    imageUrl: questions.imageUrl,
                    options: questions.options,
                    difficulty: questions.difficulty,
                    correctKey: questions.correctKey,
                    explanationMd: questions.explanationMd,
                    procedureMd: questions.procedureMd,
                    videoUrl: questions.videoUrl,
                })
                .from(questions)
                .innerJoin(subjects, eq(subjects.id, questions.subjectId))
                .where(inArray(questions.id, targetIds));

            if (rows.length === 0) {
                return reply.code(404).send({
                    error: {
                        code: 'QUESTIONS_NOT_FOUND',
                        message: 'No se encontraron preguntas válidas para corregir el intento.',
                    },
                });
            }

            const questionMap = new Map(rows.map((row) => [row.id, row]));
            const orderedRows = targetIds
                .map((id) => questionMap.get(id))
                .filter((row): row is NonNullable<typeof row> => row !== undefined);

            const now = new Date();
            const resolvedEndTime = parseTimestamp(endTime, now);
            const resolvedStartTime = parseTimestamp(startTime, resolvedEndTime);

            let score = 0;
            let answeredCount = 0;

            const results = orderedRows.map((question) => {
                const rawSelected = answers[question.id];
                const trimmedSelected = rawSelected?.trim();
                const selectedKey = trimmedSelected && trimmedSelected.length > 0 ? trimmedSelected : null;

                if (selectedKey !== null) {
                    answeredCount += 1;
                }

                const isCorrect =
                    selectedKey !== null &&
                    selectedKey.toUpperCase() === question.correctKey.trim().toUpperCase();

                if (isCorrect) {
                    score += 1;
                }

                return {
                    questionId: question.id,
                    subjectId: question.subjectId,
                    subjectCode: question.subjectCode,
                    subjectName: question.subjectName,
                    topic: question.topic,
                    statementMd: question.statementMd,
                    imageUrl: question.imageUrl,
                    options: question.options,
                    difficulty: question.difficulty,
                    selectedKey,
                    correctKey: question.correctKey,
                    isCorrect,
                    explanationMd: question.explanationMd,
                    procedureMd: question.procedureMd,
                    videoUrl: question.videoUrl,
                };
            });

            const totalQuestions = results.length;
            const unansweredCount = totalQuestions - answeredCount;
            const percentage = roundPercentage(score, totalQuestions);
            const bySubject = buildSubjectBreakdown(results);

            const insertedAttempt = await db.transaction(async (tx) => {
                const [attemptRow] = await tx
                    .insert(attempts)
                    .values({
                        userId,
                        status: 'completed',
                        score,
                        totalQuestions,
                        startTime: resolvedStartTime,
                        endTime: resolvedEndTime,
                    })
                    .returning({ id: attempts.id, status: attempts.status });

                await tx.insert(attemptAnswers).values(
                    results.map((item) => ({
                        attemptId: attemptRow.id,
                        questionId: item.questionId,
                        selectedKey: item.selectedKey,
                        isCorrect: item.isCorrect,
                    })),
                );

                return attemptRow;
            });

            return reply.code(200).send({
                data: {
                    attemptId: insertedAttempt.id,
                    userId,
                    status: insertedAttempt.status,
                    score,
                    totalQuestions,
                    answeredCount,
                    unansweredCount,
                    percentage,
                    startTime: resolvedStartTime.toISOString(),
                    endTime: resolvedEndTime.toISOString(),
                    bySubject,
                    results,
                },
            });
        } catch (error) {
            request.log.error({ err: error }, 'Error al corregir y guardar el intento');

            return reply.code(500).send({
                error: {
                    code: 'ATTEMPT_SUBMIT_FAILED',
                    message: 'No se pudo procesar ni guardar el intento.',
                },
            });
        }
    });

    app.get('/api/attempts', {
        preHandler: requireAuth,
        schema: {
            tags: ['attempts'],
            summary: 'Historial de intentos del usuario autenticado',
            description:
                'Devuelve los simulacros realizados por el usuario autenticado ordenados del más reciente al más antiguo.',
            response: {
                200: attemptHistoryResponseSchema,
                401: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const userId = request.authSession!.user.id;

            const rows = await db
                .select({
                    id: attempts.id,
                    score: attempts.score,
                    totalQuestions: attempts.totalQuestions,
                    status: attempts.status,
                    startTime: attempts.startTime,
                    endTime: attempts.endTime,
                    createdAt: attempts.createdAt,
                })
                .from(attempts)
                .where(eq(attempts.userId, userId))
                .orderBy(desc(attempts.createdAt), desc(attempts.startTime));

            const data = rows.map((row) => ({
                id: row.id,
                score: row.score,
                totalQuestions: row.totalQuestions,
                percentage: roundPercentage(row.score, row.totalQuestions),
                status: row.status,
                startTime: row.startTime.toISOString(),
                endTime: row.endTime.toISOString(),
                createdAt: row.createdAt.toISOString(),
            }));

            return reply.code(200).send({ data });
        } catch (error) {
            request.log.error({ err: error }, 'Error al obtener el historial de intentos');

            return reply.code(500).send({
                error: {
                    code: 'ATTEMPTS_FETCH_FAILED',
                    message: 'No se pudo obtener el historial de intentos.',
                },
            });
        }
    });

    app.get('/api/attempts/:id', {
        preHandler: requireAuth,
        schema: {
            tags: ['attempts'],
            summary: 'Detalle y revisión completa de un intento pasado',
            description:
                'Devuelve el puntaje, desglose por materia y revisión pregunta por pregunta de un intento perteneciente al usuario autenticado.',
            params: attemptDetailParamsSchema,
            response: {
                200: submitAttemptResponseSchema,
                401: apiErrorSchema,
                404: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        try {
            const userId = request.authSession!.user.id;
            const { id } = request.params;

            const [attemptRow] = await db
                .select({
                    id: attempts.id,
                    userId: attempts.userId,
                    status: attempts.status,
                    score: attempts.score,
                    totalQuestions: attempts.totalQuestions,
                    startTime: attempts.startTime,
                    endTime: attempts.endTime,
                })
                .from(attempts)
                .where(and(eq(attempts.id, id), eq(attempts.userId, userId)))
                .limit(1);

            if (!attemptRow) {
                return reply.code(404).send({
                    error: {
                        code: 'ATTEMPT_NOT_FOUND',
                        message: 'No se encontró el intento solicitado.',
                    },
                });
            }

            const answerRows = await db
                .select({
                    questionId: questions.id,
                    subjectId: questions.subjectId,
                    subjectCode: subjects.code,
                    subjectName: subjects.name,
                    topic: questions.topic,
                    statementMd: questions.statementMd,
                    imageUrl: questions.imageUrl,
                    options: questions.options,
                    difficulty: questions.difficulty,
                    selectedKey: attemptAnswers.selectedKey,
                    correctKey: questions.correctKey,
                    isCorrect: attemptAnswers.isCorrect,
                    explanationMd: questions.explanationMd,
                    procedureMd: questions.procedureMd,
                    videoUrl: questions.videoUrl,
                })
                .from(attemptAnswers)
                .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
                .innerJoin(subjects, eq(subjects.id, questions.subjectId))
                .where(eq(attemptAnswers.attemptId, attemptRow.id))
                .orderBy(asc(subjects.code), asc(questions.id));

            const answeredCount = answerRows.filter((item) => item.selectedKey !== null).length;
            const totalQuestions =
                attemptRow.totalQuestions > 0 ? attemptRow.totalQuestions : answerRows.length;
            const unansweredCount = Math.max(totalQuestions - answeredCount, 0);
            const percentage = roundPercentage(attemptRow.score, totalQuestions);
            const bySubject = buildSubjectBreakdown(answerRows);

            return reply.code(200).send({
                data: {
                    attemptId: attemptRow.id,
                    userId: attemptRow.userId,
                    status: attemptRow.status,
                    score: attemptRow.score,
                    totalQuestions,
                    answeredCount,
                    unansweredCount,
                    percentage,
                    startTime: attemptRow.startTime.toISOString(),
                    endTime: attemptRow.endTime.toISOString(),
                    bySubject,
                    results: answerRows,
                },
            });
        } catch (error) {
            request.log.error({ err: error }, 'Error al obtener el detalle del intento');

            return reply.code(500).send({
                error: {
                    code: 'ATTEMPT_DETAIL_FAILED',
                    message: 'No se pudo obtener el detalle del intento.',
                },
            });
        }
    });
};
