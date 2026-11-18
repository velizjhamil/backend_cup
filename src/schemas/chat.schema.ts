import { z } from 'zod';

export const chatMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
});

export const chatRequestBodySchema = z.object({
    messages: z
        .array(chatMessageSchema)
        .min(1)
        .max(30)
        .meta({ description: 'Historial conversacional entre estudiante y tutor.' }),
    questionId: z
        .string()
        .trim()
        .min(1)
        .optional()
        .meta({ description: 'ID opcional de la pregunta para inyectar su contexto oficial en el System Prompt.' }),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatRequestBody = z.infer<typeof chatRequestBodySchema>;
