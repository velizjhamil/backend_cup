import { z } from 'zod';

export const weakTopicItemSchema = z.object({
    subjectId: z.uuid(),
    subjectCode: z.string(),
    subjectName: z.string(),
    topic: z.string(),
    totalSeen: z.number().int(),
    wrongCount: z.number().int(),
    correctCount: z.number().int(),
    errorRate: z.number(),
    failedQuestionIds: z.array(z.string()),
});

export const weakQuestionItemSchema = z.object({
    questionId: z.string(),
    subjectId: z.uuid(),
    subjectCode: z.string(),
    subjectName: z.string(),
    topic: z.string(),
    statementMd: z.string(),
    totalSeen: z.number().int(),
    wrongCount: z.number().int(),
    errorRate: z.number(),
});

export const weakPointsResponseSchema = z.object({
    data: z.object({
        totalAnswersAnalyzed: z.number().int(),
        totalWrongAnswers: z.number().int(),
        failedQuestionIds: z.array(z.string()),
        byTopic: z.array(weakTopicItemSchema),
        byQuestion: z.array(weakQuestionItemSchema),
    }),
});

export const recommendationsResponseSchema = z.object({
    data: z.object({
        recommendationsMd: z
            .string()
            .meta({ description: 'Hasta 3 consejos de estudio accionables en Markdown generados por IA.' }),
        hasEnoughData: z
            .boolean()
            .meta({ description: 'false si el usuario todavía no tiene suficiente historial de errores para recomendaciones personalizadas.' }),
    }),
});

export type WeakTopicItem = z.infer<typeof weakTopicItemSchema>;
export type WeakQuestionItem = z.infer<typeof weakQuestionItemSchema>;
export type WeakPointsResponse = z.infer<typeof weakPointsResponseSchema>;
export type WeakPointsData = WeakPointsResponse['data'];
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;
export type RecommendationsData = RecommendationsResponse['data'];
