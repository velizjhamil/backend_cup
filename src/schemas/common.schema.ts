import { z } from 'zod';

/**
 * Formato de error uniforme de toda la API: `{ error: { code, message } }`.
 * Lo aplica el error handler global de Fastify (ver src/server.ts).
 */
export const apiErrorSchema = z.object({
    error: z.object({
        code: z.string(),
        message: z.string(),
    }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
