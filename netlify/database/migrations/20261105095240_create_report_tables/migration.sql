CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_days" (
	"month_key" text,
	"day_number" integer,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_days_pkey" PRIMARY KEY("month_key","day_number")
);
--> statement-breakpoint
CREATE TABLE "report_months" (
	"month_key" text PRIMARY KEY,
	"worker_id" text,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"is_sample_data" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_days" ADD CONSTRAINT "report_days_month_key_report_months_month_key_fkey" FOREIGN KEY ("month_key") REFERENCES "report_months"("month_key") ON DELETE CASCADE;