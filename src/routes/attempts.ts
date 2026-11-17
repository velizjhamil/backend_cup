import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { attemptAnswers, attempts, questions, subjects } from '../db/schema.js';
import { getSession } from '../modules/auth/guards.js';
import { apiErrorSchema } from '../schemas/common.schema.js';
import {
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

            const subjectStats = new Map<
                string,
                { subjectId: string; subjectCode: string; subjectName: string; total: number; correct: number }
            >();

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

                const currentSubject = subjectStats.get(question.subjectId) ?? {
                    subjectId: question.subjectId,
                    subjectCode: question.subjectCode,
                    subjectName: question.subjectName,
                    total: 0,
                    correct: 0,
                };
                currentSubject.total += 1;
                if (isCorrect) {
                    currentSubject.correct += 1;
                }
                subjectStats.set(question.subjectId, currentSubject);

                return {
                    questionId: question.id,
                    subjectId: question.subjectId,
                    subjectCode: question.subjectCode,
                    subjectName: question.subjectName,
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
            const bySubject = Array.from(subjectStats.values())
                .sort((a, b) => a.subjectCode.localeCompare(b.subjectCode))
                .map((item) => ({
                    ...item,
                    percentage: roundPercentage(item.correct, item.total),
                }));

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
};
