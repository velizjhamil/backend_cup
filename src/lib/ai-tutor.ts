import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { env, isGeminiEnabled } from '../config/env.js';
import type { QuestionOption } from '../db/schema.js';
import type { ChatMessage } from '../schemas/chat.schema.js';
import type { WeakPointsData } from '../schemas/stats.schema.js';

const RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const BASE_TUTOR_SYSTEM_PROMPT =
    'Eres un tutor experto del CUP de la UAGRM. Explica paso a paso sin dar la respuesta directamente si el alumno está practicando. Sé conciso y pedagógico. Cuando uses expresiones matemáticas o físicas, escríbelas en LaTeX con $...$ o $$...$$.';

export const RECOMMENDATIONS_SYSTEM_PROMPT =
    'Eres un tutor experto del CUP de la UAGRM. A partir de las estadísticas de errores de un estudiante, redacta exactamente 3 consejos de estudio concretos y accionables, en formato Markdown (lista numerada). Sé breve, cercano y motivador, sin inventar datos que no te dieron. Cuando uses expresiones matemáticas o físicas, escríbelas en LaTeX con $...$ o $$...$$.';

export type TutorQuestionContext = {
    id: string;
    subjectName: string;
    topic: string;
    statementMd: string;
    options: QuestionOption[];
    correctKey: string;
    explanationMd: string | null;
    procedureMd: string | null;
};

type MinuteBucket = {
    count: number;
    resetAt: number;
};

type DailyBucket = {
    dateKey: string;
    count: number;
};

type CachedExplanation = {
    explanation: string;
    createdAt: number;
};

const minuteRateBuckets = new Map<string, MinuteBucket>();
const dailyQuotaBuckets = new Map<string, DailyBucket>();
const questionExplanationCache = new Map<string, CachedExplanation>();

function getUtcDateKey(now = new Date()): string {
    return now.toISOString().slice(0, 10);
}

export type RateLimitCheckResult =
    | { allowed: true }
    | { allowed: false; reason: 'minute_rate_limit' | 'daily_quota_exceeded'; message: string };

/**
 * Aplica límite de velocidad por minuto (20 req/min) y cuota diaria diferenciada
 * según si el usuario está autenticado (`AI_DAILY_LIMIT_USER`) o es invitado (`AI_DAILY_LIMIT_GUEST`).
 */
export function consumeAiQuota(identityKey: string, isAuthenticated: boolean): RateLimitCheckResult {
    const now = Date.now();
    const minuteBucket = minuteRateBuckets.get(identityKey);

    if (!minuteBucket || now >= minuteBucket.resetAt) {
        minuteRateBuckets.set(identityKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    } else {
        if (minuteBucket.count >= MAX_REQUESTS_PER_MINUTE) {
            return {
                allowed: false,
                reason: 'minute_rate_limit',
                message: 'Demasiadas consultas al tutor en poco tiempo. Esperá unos segundos antes de volver a preguntar.',
            };
        }
        minuteBucket.count += 1;
    }

    const todayKey = getUtcDateKey(new Date(now));
    const dailyLimit = isAuthenticated ? env.AI_DAILY_LIMIT_USER : env.AI_DAILY_LIMIT_GUEST;
    const dailyBucket = dailyQuotaBuckets.get(identityKey);

    if (!dailyBucket || dailyBucket.dateKey !== todayKey) {
        dailyQuotaBuckets.set(identityKey, { dateKey: todayKey, count: 1 });
        return { allowed: true };
    }

    if (dailyBucket.count >= dailyLimit) {
        return {
            allowed: false,
            reason: 'daily_quota_exceeded',
            message: isAuthenticated
                ? `Alcanzaste tu límite diario de ${dailyLimit} consultas al tutor IA.`
                : `Alcanzaste el límite diario para invitados (${dailyLimit} consultas). Iniciá sesión para ampliar tu cuota.`,
        };
    }

    dailyBucket.count += 1;
    return { allowed: true };
}

/**
 * Recupera la explicación inicial cacheada en memoria para una pregunta.
 */
export function getCachedQuestionExplanation(questionId: string): string | null {
    const entry = questionExplanationCache.get(questionId);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
        questionExplanationCache.delete(questionId);
        return null;
    }

    return entry.explanation;
}

/**
 * Guarda la explicación inicial generada por la IA para reutilizarla sin gastar tokens.
 */
export function setCachedQuestionExplanation(questionId: string, explanation: string): void {
    const trimmed = explanation.trim();
    if (!trimmed) return;
    questionExplanationCache.set(questionId, {
        explanation: trimmed,
        createdAt: Date.now(),
    });
}

/**
 * Construye el System Prompt inyectando los datos oficiales de la pregunta desde Postgres.
 */
export function buildTutorSystemPrompt(questionContext?: TutorQuestionContext | null): string {
    if (!questionContext) {
        return BASE_TUTOR_SYSTEM_PROMPT;
    }

    const formattedOptions = questionContext.options
        .map((opt) => `- ${opt.key}) ${opt.text}`)
        .join('\n');

    return [
        BASE_TUTOR_SYSTEM_PROMPT,
        '',
        'Contexto oficial de la pregunta desde la base de datos (tómalo como única fuente de verdad):',
        `- ID: ${questionContext.id}`,
        `- Materia: ${questionContext.subjectName}`,
        `- Tema: ${questionContext.topic}`,
        `- Enunciado:\n${questionContext.statementMd}`,
        `- Opciones:\n${formattedOptions}`,
        `- Respuesta correcta oficial: ${questionContext.correctKey}`,
        questionContext.explanationMd
            ? `- Explicación de referencia:\n${questionContext.explanationMd}`
            : null,
        questionContext.procedureMd
            ? `- Procedimiento de referencia:\n${questionContext.procedureMd}`
            : null,
        '',
        'Si el alumno ya está viendo la pantalla de revisión tras finalizar el simulacro y te pide la explicación completa, aclárale por qué la respuesta correcta es válida y por qué las demás opciones no aplican.',
    ]
        .filter((line): line is string => line !== null)
        .join('\n');
}

type FallbackReason = 'missing_key' | 'provider_error';

function buildFallbackTutorReply(
    messages: readonly ChatMessage[],
    questionContext: TutorQuestionContext | null | undefined,
    reason: FallbackReason,
): string {
    const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user')?.content ?? '';

    if (!questionContext) {
        const cause =
            reason === 'missing_key'
                ? 'Actualmente el servidor no tiene configurada `GEMINI_API_KEY` para generar una respuesta libre en vivo.'
                : 'El tutor IA no está disponible en este momento (el proveedor de IA no respondió).';
        const advice =
            reason === 'missing_key'
                ? 'volver a intentar cuando configures la clave de Gemini en el backend.'
                : 'volver a intentar en unos minutos.';

        return (
            `${cause}\n\n` +
            `Sobre tu consulta (*"${lastUserMessage.slice(0, 120)}"*), te recomiendo repasar los conceptos fundamentales de la materia y ${advice}`
        );
    }

    const parts: string[] = [
        `### Guía paso a paso — ${questionContext.subjectName} (${questionContext.topic})`,
    ];

    if (questionContext.procedureMd) {
        parts.push(`**Procedimiento:**\n${questionContext.procedureMd}`);
    }

    if (questionContext.explanationMd) {
        parts.push(`**Idea clave:**\n${questionContext.explanationMd}`);
    }

    parts.push(
        `**Verificación:** La alternativa correcta registrada para este ejercicio es la **${questionContext.correctKey}**.`,
    );

    parts.push(
        reason === 'missing_key'
            ? '_Nota: respuesta generada desde el material de referencia local (configurá `GEMINI_API_KEY` en `backend_cup/.env` para habilitar respuestas interactivas con Gemini)._'
            : '_Nota: el tutor IA no respondió en este momento; esta guía sale del material de referencia oficial. Probá de nuevo en unos minutos para una explicación interactiva._',
    );

    return parts.join('\n\n');
}

function splitIntoChunks(text: string, chunkSize = 24): string[] {
    const chunks: string[] = [];
    for (let index = 0; index < text.length; index += chunkSize) {
        chunks.push(text.slice(index, index + chunkSize));
    }
    return chunks;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Emite una cadena completa en chunks SSE simulando streaming ordenado (usado en hits de caché o fallback).
 */
export async function* streamTextChunks(text: string): AsyncGenerator<string> {
    for (const chunk of splitIntoChunks(text)) {
        yield chunk;
        await sleep(12);
    }
}

function splitChatMessagesForGemini(messages: readonly ChatMessage[]): {
    history: Content[];
    latestMessage: string;
} {
    const lastUserIndex = messages.map((msg) => msg.role).lastIndexOf('user');
    if (lastUserIndex === -1) {
        return {
            history: [],
            latestMessage: messages[messages.length - 1]?.content ?? '',
        };
    }

    const priorMessages = messages.slice(0, lastUserIndex);
    const firstUserIndex = priorMessages.findIndex((msg) => msg.role === 'user');
    const validHistorySlice = firstUserIndex === -1 ? [] : priorMessages.slice(firstUserIndex);

    const history: Content[] = validHistorySlice.map((msg) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
    }));

    return {
        history,
        latestMessage: messages[lastUserIndex]!.content,
    };
}

/**
 * Genera el stream de tokens del Tutor IA usando `@google/generative-ai`.
 * Si falta `GEMINI_API_KEY` o falla el proveedor externo, cae al fallback pedagógico local.
 */
export async function* streamTutorResponse(params: {
    messages: readonly ChatMessage[];
    questionContext?: TutorQuestionContext | null;
    signal?: AbortSignal;
}): AsyncGenerator<string> {
    const { messages, questionContext, signal } = params;

    if (!isGeminiEnabled || !env.GEMINI_API_KEY) {
        yield* streamTextChunks(buildFallbackTutorReply(messages, questionContext, 'missing_key'));
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        const systemInstruction = buildTutorSystemPrompt(questionContext);
        const model = genAI.getGenerativeModel({
            model: env.GEMINI_MODEL,
            systemInstruction,
        });

        const { history, latestMessage } = splitChatMessagesForGemini(messages);
        const chat = model.startChat({ history });
        const result = await chat.sendMessageStream(latestMessage);

        let emittedAny = false;
        for await (const chunk of result.stream) {
            if (signal?.aborted) break;
            const text = chunk.text();
            if (text.length > 0) {
                emittedAny = true;
                yield text;
            }
        }

        if (!emittedAny && !signal?.aborted) {
            yield* streamTextChunks(buildFallbackTutorReply(messages, questionContext, 'provider_error'));
        }
    } catch (error) {
        console.error('[ai-tutor] Error al consultar Gemini, usando fallback local:', error);
        if (!signal?.aborted) {
            yield* streamTextChunks(buildFallbackTutorReply(messages, questionContext, 'provider_error'));
        }
    }
}

function buildWeakPointsSummary(weakPoints: WeakPointsData): string {
    const topTopics = weakPoints.byTopic.slice(0, 5);
    const lines = topTopics.map(
        (t) => `- ${t.subjectName} · ${t.topic}: ${t.wrongCount}/${t.totalSeen} fallos (${t.errorRate}% de error)`,
    );

    return [
        `El estudiante falló ${weakPoints.totalWrongAnswers} de ${weakPoints.totalAnswersAnalyzed} respuestas analizadas en sus simulacros.`,
        'Temas con mayor tasa de error:',
        ...lines,
    ].join('\n');
}

function buildFallbackRecommendations(weakPoints: WeakPointsData): string {
    const topTopics = weakPoints.byTopic.slice(0, 3);
    const tips = topTopics.map(
        (t, index) =>
            `${index + 1}. Repasá **${t.topic}** de *${t.subjectName}*: tenés ${t.errorRate}% de error ahí. Volvé a resolver ejercicios de ese tema antes del próximo simulacro.`,
    );

    while (tips.length < 3) {
        tips.push(`${tips.length + 1}. Seguí rindiendo simulacros completos para consolidar lo que ya sabés.`);
    }

    const note = !isGeminiEnabled
        ? '_Nota: recomendaciones generadas desde tus estadísticas locales (configurá `GEMINI_API_KEY` en `backend_cup/.env` para un plan más detallado)._\n\n'
        : '';

    return note + tips.join('\n\n');
}

/**
 * Genera hasta 3 consejos de estudio en Markdown a partir de los puntos débiles
 * del usuario, usando Gemini. Si falta `GEMINI_API_KEY` o falla el proveedor,
 * cae a un plan local construido con las mismas estadísticas.
 */
export async function generateStudyRecommendations(weakPoints: WeakPointsData): Promise<string> {
    if (!isGeminiEnabled || !env.GEMINI_API_KEY) {
        return buildFallbackRecommendations(weakPoints);
    }

    try {
        const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: env.GEMINI_MODEL,
            systemInstruction: RECOMMENDATIONS_SYSTEM_PROMPT,
        });

        const result = await model.generateContent(buildWeakPointsSummary(weakPoints));
        const text = result.response.text().trim();

        return text.length > 0 ? text : buildFallbackRecommendations(weakPoints);
    } catch (error) {
        console.error('[ai-tutor] Error al generar recomendaciones con Gemini, usando fallback local:', error);
        return buildFallbackRecommendations(weakPoints);
    }
}
