import { z } from 'zod';

/**
 * Una opción de respuesta. Objeto "loose" para no descartar metadatos extra
 * que a futuro se guarden en el jsonb (ej. una imagen por opción).
 */
export const questionOptionSchema = z.looseObject({
    key: z.string().meta({ description: 'Clave de la opción (ej: "A").' }),
    text: z.string().meta({ description: 'Texto visible de la opción.' }),
});

export const questionStatusSchema = z.enum(['draft', 'verified', 'flagged']);

/**
 * Pregunta tal como se expone en la API pública (práctica / caché offline).
 * NO incluye `correctKey` a propósito: la respuesta correcta solo viaja en el
 * banco para offline o en la revisión de un intento (ver docs/API.md).
 */
export const questionPublicSchema = z.object({
    id: z.string().meta({ description: 'Identificador legible (ej: "mat-001").' }),
    facultyId: z.uuid(),
    subjectId: z.uuid(),
    topic: z.string(),
    statementMd: z.string().meta({ description: 'Enunciado en Markdown.' }),
    imageUrl: z.string().nullable(),
    options: z.array(questionOptionSchema),
    explanationMd: z.string().nullable(),
    procedureMd: z.string().nullable(),
    videoUrl: z.string().nullable(),
    difficulty: z.string().nullable(),
    status: questionStatusSchema,
    sourceRef: z.string().nullable(),
});

/**
 * `faculty` y `subject` son los códigos legibles ('ficct', 'matematicas'),
 * no UUIDs: es el contrato que documenta docs/API.md.
 */
export const questionQuerySchema = z.object({
    faculty: z
        .string()
        .min(1)
        .optional()
        .meta({ description: 'Código de la facultad (ej: "ficct").' }),
    subject: z
        .string()
        .min(1)
        .optional()
        .meta({ description: 'Código de la materia (ej: "matematicas").' }),
    count: z.coerce
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .meta({ description: 'Cantidad de preguntas a devolver (selección aleatoria).' }),
    exclude: z
        .string()
        .optional()
        .meta({ description: 'IDs de preguntas a excluir, separados por coma.' }),
});

export const questionListResponseSchema = z.object({
    data: z.array(questionPublicSchema),
});

export type QuestionQuery = z.infer<typeof questionQuerySchema>;
export type QuestionPublic = z.infer<typeof questionPublicSchema>;
