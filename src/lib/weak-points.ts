import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { attemptAnswers, attempts, questions, subjects } from '../db/schema.js';
import type { WeakPointsData } from '../schemas/stats.schema.js';

function roundPercentage(part: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((part / total) * 10000) / 100;
}

type TopicAccumulator = {
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    topic: string;
    totalSeen: number;
    wrongCount: number;
    correctCount: number;
    failedQuestionIds: Set<string>;
};

type QuestionAccumulator = {
    questionId: string;
    subjectId: string;
    subjectCode: string;
    subjectName: string;
    topic: string;
    statementMd: string;
    totalSeen: number;
    wrongCount: number;
};

/**
 * Agrupa el historial de respuestas de un usuario para detectar los temas y
 * preguntas con mayor frecuencia y porcentaje de error. Reutilizado por
 * `GET /api/stats/weak-points` y `POST /api/stats/recommendations`.
 */
export async function getWeakPointsData(userId: string): Promise<WeakPointsData> {
    const rows = await db
        .select({
            questionId: questions.id,
            subjectId: questions.subjectId,
            subjectCode: subjects.code,
            subjectName: subjects.name,
            topic: questions.topic,
            statementMd: questions.statementMd,
            isCorrect: attemptAnswers.isCorrect,
        })
        .from(attemptAnswers)
        .innerJoin(attempts, eq(attempts.id, attemptAnswers.attemptId))
        .innerJoin(questions, eq(questions.id, attemptAnswers.questionId))
        .innerJoin(subjects, eq(subjects.id, questions.subjectId))
        .where(eq(attempts.userId, userId));

    const topicMap = new Map<string, TopicAccumulator>();
    const questionMap = new Map<string, QuestionAccumulator>();
    let totalWrongAnswers = 0;

    for (const row of rows) {
        const isWrong = !row.isCorrect;
        if (isWrong) {
            totalWrongAnswers += 1;
        }

        const topicKey = `${row.subjectCode}::${row.topic}`;
        const topicAcc = topicMap.get(topicKey) ?? {
            subjectId: row.subjectId,
            subjectCode: row.subjectCode,
            subjectName: row.subjectName,
            topic: row.topic,
            totalSeen: 0,
            wrongCount: 0,
            correctCount: 0,
            failedQuestionIds: new Set<string>(),
        };
        topicAcc.totalSeen += 1;
        if (isWrong) {
            topicAcc.wrongCount += 1;
            topicAcc.failedQuestionIds.add(row.questionId);
        } else {
            topicAcc.correctCount += 1;
        }
        topicMap.set(topicKey, topicAcc);

        const questionAcc = questionMap.get(row.questionId) ?? {
            questionId: row.questionId,
            subjectId: row.subjectId,
            subjectCode: row.subjectCode,
            subjectName: row.subjectName,
            topic: row.topic,
            statementMd: row.statementMd,
            totalSeen: 0,
            wrongCount: 0,
        };
        questionAcc.totalSeen += 1;
        if (isWrong) {
            questionAcc.wrongCount += 1;
        }
        questionMap.set(row.questionId, questionAcc);
    }

    const byTopic = Array.from(topicMap.values())
        .filter((item) => item.wrongCount > 0)
        .map((item) => ({
            subjectId: item.subjectId,
            subjectCode: item.subjectCode,
            subjectName: item.subjectName,
            topic: item.topic,
            totalSeen: item.totalSeen,
            wrongCount: item.wrongCount,
            correctCount: item.correctCount,
            errorRate: roundPercentage(item.wrongCount, item.totalSeen),
            failedQuestionIds: Array.from(item.failedQuestionIds).sort(),
        }))
        .sort((a, b) => {
            if (b.errorRate !== a.errorRate) return b.errorRate - a.errorRate;
            return b.wrongCount - a.wrongCount;
        });

    const sortedWrongQuestions = Array.from(questionMap.values())
        .filter((item) => item.wrongCount > 0)
        .map((item) => ({
            ...item,
            errorRate: roundPercentage(item.wrongCount, item.totalSeen),
        }))
        .sort((a, b) => {
            if (b.wrongCount !== a.wrongCount) return b.wrongCount - a.wrongCount;
            return b.errorRate - a.errorRate;
        });

    return {
        totalAnswersAnalyzed: rows.length,
        totalWrongAnswers,
        failedQuestionIds: sortedWrongQuestions.map((item) => item.questionId),
        byTopic,
        byQuestion: sortedWrongQuestions.slice(0, 10),
    };
}
