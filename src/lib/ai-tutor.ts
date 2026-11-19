import { setTimeout as delay } from 'node:timers/promises';
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

/*
 * Resilience for Gemini calls.
 *
 * Measured on 2026-11-18: under high demand the primary model answered 503 only
 * after ~214 s, so a plain "retry after 2 s" would keep a student waiting for minutes.
 * Each attempt therefore has its own timeout (until the first chunk for streams),
 * and the chain is: primary model (up to 2 attempts, retry only on 429/503) ->
 * GEMINI_FALLBACK_MODEL (1 attempt) -> local fallback reply in the caller.
 */
const RETRYABLE_STATUSES = new Set([429, 503]);
// Errors that another model cannot fix (bad request, invalid or unauthorized key).
const NON_FALLBACK_STATUSES = new Set([400, 401, 403]);
const PRIMARY_MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 2_000;
const STREAM_FIRST_CHUNK_TIMEOUT_MS = 15_000;
const GENERATE_TIMEOUT_MS = 30_000;

class GeminiTimeoutError extends Error {
    constructor(model: string, timeoutMs: number) {
        super(`Gemini (${model}) did not answer within ${timeoutMs} ms`);
        this.name = 'GeminiTimeoutError';
    }
}

class GeminiEmptyResponseError extends Error {
    constructor(model: string) {
        super(`Gemini (${model}) returned an empty response`);
        this.name = 'GeminiEmptyResponseError';
    }
}

function getGeminiStatus(error: unknown): number | undefined {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === 'number' ? status : undefined;
}

function describeGeminiError(error: unknown): string {
    if (error instanceof GeminiTimeoutError) return 'timeout';
    if (error instanceof GeminiEmptyResponseError) return 'respuesta vacía';
    const status = getGeminiStatus(error);
    return status !== undefined ? `HTTP ${status}` : error instanceof Error ? error.message : String(error);
}

function getGeminiModelChain(): string[] {
    return env.GEMINI_FALLBACK_MODEL === env.GEMINI_MODEL
        ? [env.GEMINI_MODEL]
        : [env.GEMINI_MODEL, env.GEMINI_FALLBACK_MODEL];
}

/**
 * Runs `attempt` against the model chain. `attempt` receives the model name and an
 * AbortSignal that fires on timeout or when the caller's `signal` aborts. The timeout
 * is cleared as soon as `attempt` resolves, so a stream that already started is not cut.
 * Returns `null` if the caller aborted; throws the last error if every model failed.
 */
async function callGeminiWithResilience<T>(params: {
    label: string;
    timeoutMs: number;
    signal?: AbortSignal;
    attempt: (model: string, signal: AbortSignal) => Promise<T>;
}): Promise<T | null> {
    const { label, timeoutMs, signal: outerSignal, attempt } = params;
    const chain = getGeminiModelChain();
    let lastError: unknown = null;

    for (const [modelIndex, model] of chain.entries()) {
        const maxAttempts = modelIndex === 0 ? PRIMARY_MAX_ATTEMPTS : 1;

        for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber += 1) {
            if (outerSignal?.aborted) return null;

            const timeoutController = new AbortController();
            const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
            const attemptSignal = outerSignal
                ? AbortSignal.any([outerSignal, timeoutController.signal])
                : timeoutController.signal;

            try {
                const value = await attempt(model, attemptSignal);
                if (modelIndex > 0 || attemptNumber > 1) {
                    console.warn(`[ai-tutor] ${label}: Gemini respondió con ${model} (intento ${attemptNumber}).`);
                }
                return value;
            } catch (error) {
                if (outerSignal?.aborted) return null;
                lastError = timeoutController.signal.aborted ? new GeminiTimeoutError(model, timeoutMs) : error;
            } finally {
                clearTimeout(timer);
            }

            const status = getGeminiStatus(lastError);
            const reason = describeGeminiError(lastError);

            if (status !== undefined && NON_FALLBACK_STATUSES.has(status)) {
                console.error(`[ai-tutor] ${label}: Gemini rechazó la solicitud (${reason}); no se reintenta.`);
                throw lastError;
            }

            const canRetrySameModel =
                attemptNumber < maxAttempts && status !== undefined && RETRYABLE_STATUSES.has(status);

            if (canRetrySameModel) {
                console.warn(
                    `[ai-tutor] ${label}: reintentando Gemini (${model}) por ${reason} en ${RETRY_DELAY_MS / 1000} s ` +
                        `(intento ${attemptNumber + 1}/${maxAttempts})...`,
                );
                try {
                    await delay(RETRY_DELAY_MS, undefined, { signal: outerSignal });
                } catch {
                    return null;
                }
                continue;
            }

            break;
        }

        const nextModel = chain[modelIndex + 1];
        if (nextModel) {
            console.warn(
                `[ai-tutor] ${label}: ${model} falló (${describeGeminiError(lastError)}); fallback al modelo ${nextModel}...`,
            );
        }
    }

    console.error(
        `[ai-tutor] ${label}: todos los modelos de Gemini fallaron (${describeGeminiError(lastError)}); usando fallback local.`,
    );
    throw lastError;
}

/**
 * Genera el stream de tokens del Tutor IA usando `@google/generative-ai`.
 * Si falta `GEMINI_API_KEY` o fallan el modelo principal y el de respaldo
 * (ver `callGeminiWithResilience`), cae al fallback pedagógico local.
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

    const apiKey = env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    const systemInstruction = buildTutorSystemPrompt(questionContext);
    const { history, latestMessage } = splitChatMessagesForGemini(messages);

    try {
        // Retries and model fallback only happen before the first chunk reaches the
        // student; once text was emitted, a retry would duplicate the answer.
        const opened = await callGeminiWithResilience({
            label: 'chat',
            timeoutMs: STREAM_FIRST_CHUNK_TIMEOUT_MS,
            signal,
            attempt: async (modelName, attemptSignal) => {
                const model = genAI.getGenerativeModel({ model: modelName, systemInstruction });
                const chat = model.startChat({ history });
                const result = await chat.sendMessageStream(latestMessage, { signal: attemptSignal });
                const iterator = result.stream[Symbol.asyncIterator]();

                for (;;) {
                    const next = await iterator.next();
                    if (next.done) throw new GeminiEmptyResponseError(modelName);
                    const text = next.value.text();
                    if (text.length > 0) return { firstText: text, iterator };
                }
            },
        });

        if (!opened) return;

        yield opened.firstText;

        for (;;) {
            if (signal?.aborted) break;
            const next = await opened.iterator.next();
            if (next.done) break;
            const text = next.value.text();
            if (text.length > 0) yield text;
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
        const prompt = buildWeakPointsSummary(weakPoints);

        const text = await callGeminiWithResilience({
            label: 'recommendations',
            timeoutMs: GENERATE_TIMEOUT_MS,
            attempt: async (modelName, attemptSignal) => {
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    systemInstruction: RECOMMENDATIONS_SYSTEM_PROMPT,
                });
                const result = await model.generateContent(prompt, { signal: attemptSignal });
                const output = result.response.text().trim();
                if (output.length === 0) throw new GeminiEmptyResponseError(modelName);
                return output;
            },
        });

        return text ?? buildFallbackRecommendations(weakPoints);
    } catch (error) {
        console.error('[ai-tutor] Error al generar recomendaciones con Gemini, usando fallback local:', error);
        return buildFallbackRecommendations(weakPoints);
    }
}
