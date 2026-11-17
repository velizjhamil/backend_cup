import { pgTable, text, integer, uuid, jsonb, pgEnum, timestamp, boolean, index } from 'drizzle-orm/pg-core';

export const faculties = pgTable('faculties', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(), // ej: 'ficct'
    name: text('name').notNull(),
});

export const subjects = pgTable('subjects', {
    id: uuid('id').primaryKey().defaultRandom(),
    facultyId: uuid('faculty_id').references(() => faculties.id).notNull(),
    code: text('code').notNull().unique(), // ej: 'matematicas'
    name: text('name').notNull(),
    perExam: integer('per_exam').notNull().default(10),
});

// --- NUEVO: Tabla de Preguntas ---

// Definimos los estados posibles de una pregunta
export const questionStatusEnum = pgEnum('question_status', ['draft', 'verified', 'flagged']);

// Forma de una opción de respuesta dentro del jsonb `options`.
// Solo es tipado en TypeScript: no modifica la columna en Postgres.
export type QuestionOption = {
    key: string;
    text: string;
};

export const questions = pgTable('questions', {
    id: text('id').primaryKey(), // ej: 'mat-001'
    facultyId: uuid('faculty_id').references(() => faculties.id).notNull(),
    subjectId: uuid('subject_id').references(() => subjects.id).notNull(),
    topic: text('topic').notNull(),
    statementMd: text('statement_md').notNull(),
    imageUrl: text('image_url'),
    options: jsonb('options').$type<QuestionOption[]>().notNull(), // Se guardará como: [{key: 'A', text: '...'}, ...]
    correctKey: text('correct_key').notNull(), // ej: 'A'
    explanationMd: text('explanation_md'),
    procedureMd: text('procedure_md'),
    videoUrl: text('video_url'),
    difficulty: text('difficulty'),
    status: questionStatusEnum('status').default('draft').notNull(),
    sourceRef: text('source_ref'), // Para saber de qué página del PDF salió
    // Versión de la fila: la usa /api/questions/bank para ETag / caché offline.
    updatedAt: timestamp('updated_at').defaultNow().notNull().$onUpdate(() => new Date()),
});

// --- Autenticación (Better Auth) ---
// Esquema tomado de la documentación de Better Auth 1.7 para Drizzle/PostgreSQL.
// El adaptador mapea estos nombres plurales a los modelos `user`, `session`,
// `account` y `verification` (ver src/lib/auth.ts).

export const users = pgTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    image: text('image'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const sessions = pgTable(
    'sessions',
    {
        id: text('id').primaryKey(),
        expiresAt: timestamp('expires_at').notNull(),
        token: text('token').notNull().unique(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
    },
    (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const accounts = pgTable(
    'accounts',
    {
        id: text('id').primaryKey(),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at'),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
        scope: text('scope'),
        password: text('password'),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [index('accounts_user_id_idx').on(table.userId)],
);

export const verifications = pgTable(
    'verifications',
    {
        id: text('id').primaryKey(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
    },
    (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

// --- Intentos de simulacro (Fase 5) ---

export const attemptStatusEnum = pgEnum('attempt_status', ['in_progress', 'completed']);

export const attempts = pgTable(
    'attempts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
        status: attemptStatusEnum('status').default('completed').notNull(),
        score: integer('score').notNull().default(0),
        totalQuestions: integer('total_questions').notNull().default(0),
        startTime: timestamp('start_time').defaultNow().notNull(),
        endTime: timestamp('end_time').defaultNow().notNull(),
        createdAt: timestamp('created_at').defaultNow().notNull(),
    },
    (table) => [index('attempts_user_id_idx').on(table.userId)],
);

export const attemptAnswers = pgTable(
    'attempt_answers',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        attemptId: uuid('attempt_id')
            .references(() => attempts.id, { onDelete: 'cascade' })
            .notNull(),
        questionId: text('question_id')
            .references(() => questions.id, { onDelete: 'cascade' })
            .notNull(),
        selectedKey: text('selected_key'),
        isCorrect: boolean('is_correct').notNull(),
    },
    (table) => [index('attempt_answers_attempt_id_idx').on(table.attemptId)],
);