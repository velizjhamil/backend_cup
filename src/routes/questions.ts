import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { and, asc, eq, notInArray, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { faculties, questions, subjects } from '../db/schema.js';
import { apiErrorSchema } from '../schemas/common.schema.js';
import {
    questionListResponseSchema,
    questionQuerySchema,
} from '../schemas/question.schema.js';

/**
 * Columnas expuestas públicamente. `correctKey` queda fuera por diseño:
 * la respuesta correcta no viaja al cliente en este endpoint.
 */
const publicColumns = {
    id: questions.id,
    facultyId: questions.facultyId,
    subjectId: questions.subjectId,
    topic: questions.topic,
    statementMd: questions.statementMd,
    imageUrl: questions.imageUrl,
    options: questions.options,
    explanationMd: questions.explanationMd,
    procedureMd: questions.procedureMd,
    videoUrl: questions.videoUrl,
    difficulty: questions.difficulty,
    status: questions.status,
    sourceRef: questions.sourceRef,
};

export const questionsRoutes: FastifyPluginAsyncZod = async (app) => {
    app.get('/api/questions', {
        schema: {
            tags: ['questions'],
            summary: 'Preguntas para práctica o caché offline',
            description:
                'Devuelve preguntas verificadas. Nunca incluye la respuesta correcta (`correct_key`).',
            querystring: questionQuerySchema,
            response: {
                200: questionListResponseSchema,
                404: apiErrorSchema,
                500: apiErrorSchema,
            },
        },
    }, async (request, reply) => {
        const { faculty, subject, count, exclude } = request.query;
        const excludeIds = (exclude ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter((id) => id.length > 0);

        try {
            // Un código inexistente es un error del cliente, no una lista vacía.
            if (faculty) {
                const [facultyRow] = await db
                    .select({ id: faculties.id })
                    .from(faculties)
                    .where(eq(faculties.code, faculty))
                    .limit(1);

                if (!facultyRow) {
                    return reply.code(404).send({
                        error: {
                            code: 'FACULTY_NOT_FOUND',
                            message: `No existe la facultad '${faculty}'.`,
                        },
                    });
                }
            }

            if (subject) {
                const [subjectRow] = await db
                    .select({ id: subjects.id })
                    .from(subjects)
                    .where(eq(subjects.code, subject))
                    .limit(1);

                if (!subjectRow) {
                    return reply.code(404).send({
                        error: {
                            code: 'SUBJECT_NOT_FOUND',
                            message: `No existe la materia '${subject}'.`,
                        },
                    });
                }
            }

            // Solo se muestran preguntas revisadas (draft y flagged quedan fuera).
            const conditions: SQL[] = [eq(questions.status, 'verified')];

            if (faculty) {
                conditions.push(eq(faculties.code, faculty));
            }

            if (subject) {
                conditions.push(eq(subjects.code, subject));
            }

            if (excludeIds.length > 0) {
                conditions.push(notInArray(questions.id, excludeIds));
            }

            const query = db
                .select(publicColumns)
                .from(questions)
                .innerJoin(faculties, eq(faculties.id, questions.facultyId))
                .innerJoin(subjects, eq(subjects.id, questions.subjectId))
                .where(and(...conditions));

            const rows = count
                ? await query.orderBy(sql`random()`).limit(count)
                : await query.orderBy(asc(questions.id));

            return reply.code(200).send({ data: rows });
        } catch (error) {
            request.log.error({ err: error }, 'Error al obtener las preguntas');

            return reply.code(500).send({
                error: {
                    code: 'QUESTIONS_FETCH_FAILED',
                    message: 'No se pudieron obtener las preguntas.',
                },
            });
        }
    });
};
