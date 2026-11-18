import { z } from 'zod';

/**
 * Payload enviado por el cliente al finalizar un simulacro.
 * `answers` mapea `questionId` -> `optionKey` elegida; `questionIds` permite
 * incluir también las preguntas dejadas en blanco para el cálculo exacto.
 */
export const submitAttemptBodySchema = z.object({
    answers: z
        .record(z.string(), z.string())
        .meta({ description: 'Mapa questionId -> opción marcada (ej: {"mat-001": "B"}).' }),
    questionIds: z
        .array(z.string().min(1))
        .optional()
        .meta({ description: 'Lista completa de IDs de preguntas del examen (incluidas las no respondidas).' }),
    startTime: z
        .union([z.number(), z.string()])
        .optional()
        .meta({ description: 'Timestamp (ms) o fecha ISO de inicio del intento.' }),
    endTime: z
        .union([z.number(), z.string()])
        .optional()
        .meta({ description: 'Timestamp (ms) o fecha ISO de finalización del intento.' }),
});

export const attemptQuestionOptionSchema = z.object({
    key: z.string(),
    text: z.string(),
});

export const attemptDetailParamsSchema = z.object({
    id: z.uuid().meta({ description: 'UUID del intento registrado.' }),
});

export const subjectScoreBreakdownSchema = z.object({
    subjectId: z.uuid(),
    subjectCode: z.string(),
    subjectName: z.string(),
    total: z.number().int(),
    correct: z.number().int(),
    percentage: z.number(),
});

export const questionCorrectionItemSchema = z.object({
    questionId: z.string(),
    subjectId: z.uuid(),
    subjectCode: z.string(),
    subjectName: z.string(),
    topic: z.string(),
    statementMd: z.string(),
    imageUrl: z.string().nullable(),
    options: z.array(attemptQuestionOptionSchema),
    difficulty: z.string().nullable(),
    selectedKey: z.string().nullable(),
    correctKey: z.string(),
    isCorrect: z.boolean(),
    explanationMd: z.string().nullable(),
    procedureMd: z.string().nullable(),
    videoUrl: z.string().nullable(),
});

export const submitAttemptResponseSchema = z.object({
    data: z.object({
        attemptId: z.uuid(),
        userId: z.string().nullable(),
        status: z.enum(['in_progress', 'completed']),
        score: z.number().int(),
        totalQuestions: z.number().int(),
        answeredCount: z.number().int(),
        unansweredCount: z.number().int(),
        percentage: z.number(),
        startTime: z.string(),
        endTime: z.string(),
        bySubject: z.array(subjectScoreBreakdownSchema),
        results: z.array(questionCorrectionItemSchema),
    }),
});

export type SubmitAttemptBody = z.infer<typeof submitAttemptBodySchema>;
export type SubmitAttemptResponse = z.infer<typeof submitAttemptResponseSchema>;

export const attemptHistoryItemSchema = z.object({
    id: z.uuid(),
    score: z.number().int(),
    totalQuestions: z.number().int(),
    percentage: z.number(),
    status: z.enum(['in_progress', 'completed']),
    startTime: z.string(),
    endTime: z.string(),
    createdAt: z.string(),
});

export const attemptHistoryResponseSchema = z.object({
    data: z.array(attemptHistoryItemSchema),
});

export type AttemptHistoryItem = z.infer<typeof attemptHistoryItemSchema>;
export type AttemptHistoryResponse = z.infer<typeof attemptHistoryResponseSchema>;
