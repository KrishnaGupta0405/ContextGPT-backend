-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"username" varchar(150) NOT NULL,
	"fullName" varchar(150) NOT NULL,
	"email" varchar(150) NOT NULL,
	"password" text NOT NULL,
	"avatar" text,
	"refresh_token" text,
	"role" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dummy" text,
	"dummy2" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "idx_users_username" ON "users" USING btree (lower((username)::text) text_ops);
*/