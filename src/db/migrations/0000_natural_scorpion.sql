CREATE TABLE "faculties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "faculties_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"faculty_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"per_exam" integer DEFAULT 10 NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_faculty_id_faculties_id_fk" FOREIGN KEY ("faculty_id") REFERENCES "public"."faculties"("id") ON DELETE no action ON UPDATE no action;