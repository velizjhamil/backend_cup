CREATE TYPE "public"."question_status" AS ENUM('draft', 'verified', 'flagged');--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"faculty_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"statement_md" text NOT NULL,
	"image_url" text,
	"options" jsonb NOT NULL,
	"correct_key" text NOT NULL,
	"explanation_md" text,
	"procedure_md" text,
	"video_url" text,
	"difficulty" text,
	"status" "question_status" DEFAULT 'draft' NOT NULL,
	"source_ref" text
);
--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;