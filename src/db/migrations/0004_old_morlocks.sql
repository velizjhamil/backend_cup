CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" text NOT NULL,
	"selected_key" text,
	"is_correct" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"status" "attempt_status" DEFAULT 'completed' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"start_time" timestamp DEFAULT now() NOT NULL,
	"end_time" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempt_answers_attempt_id_idx" ON "attempt_answers" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "attempts_user_id_idx" ON "attempts" USING btree ("user_id");