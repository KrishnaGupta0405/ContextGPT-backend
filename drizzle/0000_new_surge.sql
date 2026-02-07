-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "users_sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token" text NOT NULL,
	"device_info" text,
	"ip_address" "inet",
	"expires_at" timestamp with time zone NOT NULL,
	"is_revoked" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_refresh_token_key" UNIQUE("refresh_token")
);
--> statement-breakpoint
CREATE TABLE "website_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"type" varchar(50) NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"chatbot_given" integer NOT NULL,
	"pages_upto" integer NOT NULL,
	"team_member_access" integer NOT NULL,
	"api_access" boolean DEFAULT false NOT NULL,
	"auto_sync_data" boolean DEFAULT false NOT NULL,
	"auto_sync_data_occurrence" varchar(20),
	"webhook_support" boolean DEFAULT false NOT NULL,
	"platform_integration_allowed" text[],
	"custom_platform_integration" boolean DEFAULT false NOT NULL,
	"user_message_rate_limit" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_auto_sync_occurrence" CHECK ((auto_sync_data = false) OR ((auto_sync_data_occurrence)::text = ANY ((ARRAY['monthly'::character varying, 'weekly'::character varying, 'daily'::character varying])::text[])))
);
--> statement-breakpoint
CREATE TABLE "website_llm_models" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"provider" varchar(50) NOT NULL,
	"title" varchar(100) NOT NULL,
	"cost_per_1k_tokens" numeric(10, 4) NOT NULL,
	"under_this_subscription_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbots" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" varchar(50) NOT NULL,
	"name" varchar(50),
	"profile_pic" text,
	"facebook_link" text,
	"instagram_link" text,
	"linkedin_link" text,
	"twitter_link" text,
	"youtube_link" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "users_team_members" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"leaved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_chatbot_user" UNIQUE("chatbot_id","user_id"),
	CONSTRAINT "chk_team_role" CHECK ((role)::text = ANY ((ARRAY['AGENT'::character varying, 'MANAGER'::character varying, 'ADMIN'::character varying, 'SUPER_ADMIN'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "users_invitations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"role" varchar(20) NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_invite_role" CHECK ((role)::text = ANY ((ARRAY['AGENT'::character varying, 'MANAGER'::character varying, 'ADMIN'::character varying])::text[])),
	CONSTRAINT "chk_invite_status" CHECK ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'EXPIRED'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "users_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"max_chatbots_allowed" integer NOT NULL,
	"max_tokens_allowed" integer,
	"max_pages_allowed" integer NOT NULL,
	"user_message_rate_limit" integer NOT NULL,
	"bonus_messages" integer DEFAULT 0,
	"bonus_pages" integer DEFAULT 0,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_subscription_status" CHECK ((status)::text = ANY ((ARRAY['active'::character varying, 'trialing'::character varying, 'past_due'::character varying, 'canceled'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "users_addons_purchased" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"remove_watermark" boolean DEFAULT false NOT NULL,
	"priority_support" boolean DEFAULT false NOT NULL,
	"customer_branding" boolean DEFAULT false NOT NULL,
	"purchase_date" timestamp DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"extra_messages_granted" integer DEFAULT 0 NOT NULL,
	"extra_chatbots_granted" integer DEFAULT 0 NOT NULL,
	"price_paid" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "website_add_ons" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"title" text NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_referrals" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"referrer_user_id" uuid NOT NULL,
	"referred_user_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	"redeemed_at" timestamp DEFAULT now() NOT NULL,
	"bonus_messages" integer DEFAULT 0,
	"bonus_pages" integer DEFAULT 0,
	"expiry_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_unique_referral" UNIQUE("referrer_user_id","referred_user_id","promotion_id"),
	CONSTRAINT "chk_no_self_referral" CHECK (referrer_user_id <> referred_user_id)
);
--> statement-breakpoint
CREATE TABLE "website_promotion_referral" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"promotion_share_text" text NOT NULL,
	"promo_code" varchar(20),
	"message_added" integer DEFAULT 0,
	"pages_added" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"target_audience" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "website_promotion_referral_promo_code_key" UNIQUE("promo_code"),
	CONSTRAINT "chk_target_audience" CHECK ((target_audience)::text = ANY ((ARRAY['NEW_USERS'::character varying, 'EXISTING_USERS'::character varying, 'ALL'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "users_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"subject_type" varchar(20) NOT NULL,
	"subject_id" uuid NOT NULL,
	"window_seconds" integer NOT NULL,
	"request_limit" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_subject_type" CHECK ((subject_type)::text = ANY ((ARRAY['USER'::character varying, 'API_KEY'::character varying, 'CHATBOT'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "users_llm_model_usage" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"messages_count" integer DEFAULT 0 NOT NULL,
	"tokens_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users_usage_tracking" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"chatbots_created_count" integer DEFAULT 0 NOT NULL,
	"messages_sent_count" integer DEFAULT 0 NOT NULL,
	"token_used" integer DEFAULT 0 NOT NULL,
	"messages_received_count" integer DEFAULT 0 NOT NULL,
	"total_pages_indexed" integer DEFAULT 0 NOT NULL,
	"team_members_count" integer DEFAULT 0 NOT NULL,
	"llm_usage_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_billing_period" UNIQUE("user_id","billing_period_start")
);
--> statement-breakpoint
CREATE TABLE "users_billing" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"razorpay_payment_id" varchar(255),
	"razorpay_order_id" varchar(255),
	"razorpay_signature" varchar(255),
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"subscription_purchased_id" uuid,
	"addon_purchased_id" uuid,
	"referral_id" uuid,
	"billing_type" varchar(20) NOT NULL,
	"payment_method" varchar(20),
	"payment_details" jsonb,
	"payment_status" varchar(20) NOT NULL,
	"error_code" varchar(20),
	"invoice_id" varchar(100),
	"invoice_pdf_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_billing_razorpay_payment_id_key" UNIQUE("razorpay_payment_id"),
	CONSTRAINT "chk_billing_type" CHECK ((billing_type)::text = ANY ((ARRAY['SUBSCRIPTION'::character varying, 'ADDON'::character varying, 'REFERRAL'::character varying])::text[])),
	CONSTRAINT "chk_payment_status" CHECK ((payment_status)::text = ANY ((ARRAY['created'::character varying, 'authorized'::character varying, 'captured'::character varying, 'refunded'::character varying, 'failed'::character varying])::text[])),
	CONSTRAINT "chk_single_purchase_target" CHECK (((((subscription_purchased_id IS NOT NULL))::integer + ((addon_purchased_id IS NOT NULL))::integer) + ((referral_id IS NOT NULL))::integer) = 1)
);
--> statement-breakpoint
CREATE TABLE "users_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key" varchar(255) NOT NULL,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_api_keys_api_key_key" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "users_api_request_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_id" uuid NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"status_code" integer NOT NULL,
	"request_ip" "inet",
	"user_agent" text,
	"response_timestamp" timestamp,
	"error" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_appearance_ui" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"chatbot_name" varchar(100),
	"tooltip" text,
	"welcome_message" text,
	"input_placeholder_text" text,
	"brand_primary_color" varchar(7),
	"brand_text_color" varchar(7),
	"brand_icon_bg_color" varchar(7),
	"show_background" boolean DEFAULT true,
	"link_color" varchar(7),
	"font_size" integer,
	"chat_height" integer,
	"external_link" text,
	"icon_size" varchar(20),
	"icon_position" varchar(20),
	"default_mode" varchar(20),
	"watermark_brand_icon" text,
	"watermark_brand_text" text,
	"watermark_brand_link" text,
	"watermark_brand_info_show" boolean DEFAULT true,
	"hide_watermark_sitegpt" boolean DEFAULT false,
	"right_to_left_mode" boolean DEFAULT false,
	"enable_dark_mode" boolean DEFAULT false,
	"distance_from_bottom" integer,
	"horizontal_distance" integer,
	"bot_icon_src" varchar(64),
	"user_icon_src" varchar(64),
	"agent_icon_src" varchar(64),
	"bubble_icon_src" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_chatbot_appearance_ui_chatbot_id_key" UNIQUE("chatbot_id")
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_behavior" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"hide_sources" boolean DEFAULT false,
	"hide_tooltip" boolean DEFAULT false,
	"hide_feedback_buttons" boolean DEFAULT false,
	"hide_bottom_navigation" boolean DEFAULT false,
	"hide_refresh_button" boolean DEFAULT false,
	"hide_expand_button" boolean DEFAULT false,
	"hide_home_page" boolean DEFAULT false,
	"stay_on_home_page" boolean DEFAULT false,
	"require_terms_acceptance" boolean DEFAULT false,
	"disclaimer_text" text,
	"auto_open_chat_desktop" boolean DEFAULT false,
	"auto_open_chat_desktop_delay" integer,
	"auto_open_chat_mobile" boolean DEFAULT false,
	"auto_open_chat_mobile_delay" integer,
	"smart_follow_up_prompts_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_chatbot_behavior_chatbot_id_key" UNIQUE("chatbot_id")
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_settings_general" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"description" text,
	"disable_smart_followup" boolean DEFAULT false,
	"number_of_smart_followup_question_shown" integer,
	"enable_page_context_awareness" boolean DEFAULT false,
	"history_message_context" integer,
	"llm_model" varchar(50),
	"limit_messages_per_conversation" boolean DEFAULT false,
	"max_messages_per_conversation" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_chatbot_settings_general_chatbot_id_key" UNIQUE("chatbot_id")
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_chatting_customers" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"email" varchar(255),
	"name" varchar(255),
	"phone_number" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cache_delete_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"user_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_files" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_type" varchar(50) NOT NULL,
	"file_size" integer NOT NULL,
	"file_tokens" integer,
	"file_pages" integer,
	"file_source" varchar(50) NOT NULL,
	"origin" varchar(20) NOT NULL,
	"source_id" uuid,
	"s3_url" text NOT NULL,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_chunks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"file_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"s3_chunk_url" text NOT NULL,
	"chunk_text_preview_link" text,
	"token_count" integer NOT NULL,
	"embedding_status" varchar(20) NOT NULL,
	"pinecone_vector_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_file_chunk_index" UNIQUE("file_id","chunk_index")
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_conversation_starters" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"button_message" text NOT NULL,
	"link_text" varchar(255),
	"link_src" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_custom_prompts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"temperature" real,
	"deletable" boolean DEFAULT false,
	"creativity_level" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_follow_up_prompts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"button_title" varchar(255),
	"button_message" text,
	"link_text" varchar(255),
	"link_src" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_settings_instruction" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"title" varchar(100),
	"instruction" text NOT NULL,
	"creativity_level" real DEFAULT 0.5 NOT NULL,
	"deletable" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_chatbot_settings_instruction_chatbot_id_key" UNIQUE("chatbot_id")
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_personas" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"title" varchar(50) NOT NULL,
	"description" text,
	"instructions" text NOT NULL,
	"creativity_level" real DEFAULT 0.5 NOT NULL,
	"deletable" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_settings_localization_texts" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"home_title" text,
	"home_description" text,
	"add_details" text,
	"start_conversation" text,
	"starting" text,
	"messages_title" text,
	"messages_description" text,
	"no_messages" text,
	"verify_email_message" text,
	"conversation_history_info" text,
	"bot_label" text,
	"you_label" text,
	"agent_label" text,
	"escalate_confirmation" text,
	"escalate_description" text,
	"yes_continue" text,
	"cancel" text,
	"switched_to_human" text,
	"start_new_conversation" text,
	"max_messages_title" text,
	"max_messages_description" text,
	"connected" text,
	"disconnected" text,
	"connecting" text,
	"disconnecting" text,
	"reconnect" text,
	"account_title" text,
	"verify_email_title" text,
	"verify_email_description" text,
	"email_label" text,
	"name_label" text,
	"phone_label" text,
	"submit_button" text,
	"sending_otp" text,
	"verify_otp" text,
	"otp_sent_message" text,
	"otp_label" text,
	"verify_continue" text,
	"resend_otp" text,
	"edit_details" text,
	"resetting" text,
	"verifying" text,
	"logout" text,
	"logging_out" text,
	"verified" text,
	"edit" text,
	"update" text,
	"updating" text,
	"lead_form_title" text,
	"lead_form_description" text,
	"form_heading" text,
	"form_submitted_message" text,
	"continue_button" text,
	"submitting_text" text,
	"input_disabled_placeholder" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_integrations" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"platform_type" varchar(30) NOT NULL,
	"config" jsonb NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_platform_type" CHECK ((platform_type)::text = ANY ((ARRAY['SLACK'::character varying, 'MESSENGER'::character varying, 'CRISP'::character varying, 'ZOHO_SALES_IQ'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_human_support_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"enable_human_support" boolean DEFAULT false,
	"replace_all_other_suggestions_with_escalation_buttons" boolean DEFAULT false,
	"positive_feedback_prompt" text,
	"request_human_support_prompt" text,
	"human_support_confirmation_message" text,
	"lead_notification" boolean DEFAULT false,
	"lead_notification_email" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_leads_settings" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"enable_lead_collection" boolean DEFAULT false,
	"customer_name_take" boolean DEFAULT false,
	"customer_name" text,
	"customer_phone_take" boolean DEFAULT false,
	"customer_phone" text,
	"customer_email_take" boolean DEFAULT true NOT NULL,
	"customer_email" text,
	"industry_template" text,
	"when_to_collect_lead" text,
	"customer_trigger_keywords" text,
	"customer_form_field" jsonb,
	"booking_integration" boolean DEFAULT false,
	"booking_integration_link" text,
	"lead_notification" boolean DEFAULT false,
	"lead_notification_email" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_when_to_collect_lead" CHECK ((when_to_collect_lead IS NULL) OR (when_to_collect_lead = ANY (ARRAY['interest'::text, 'unable_to_answer'::text, 'after_n_messages'::text])))
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_threads" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"chat_user_id" uuid,
	"unread_messages_count" integer DEFAULT 0 NOT NULL,
	"webhook_url" text,
	"webhook_token" text,
	"escalated" boolean DEFAULT false NOT NULL,
	"important" boolean DEFAULT false NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"tags" jsonb,
	"positive_count" integer DEFAULT 0 NOT NULL,
	"negative_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ingestion_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"entity_type" varchar(20) NOT NULL,
	"file_id" uuid,
	"chunk_id" uuid,
	"source_id" uuid,
	"status" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_exactly_one_entity" CHECK ((((entity_type)::text = 'FILE'::text) AND (file_id IS NOT NULL) AND (chunk_id IS NULL) AND (source_id IS NULL)) OR (((entity_type)::text = 'CHUNK'::text) AND (chunk_id IS NOT NULL) AND (file_id IS NULL) AND (source_id IS NULL)) OR (((entity_type)::text = 'SOURCE'::text) AND (source_id IS NOT NULL) AND (file_id IS NULL) AND (chunk_id IS NULL)))
);
--> statement-breakpoint
CREATE TABLE "ingestion_errors" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"chunk_id" uuid,
	"step" varchar(50) NOT NULL,
	"error_message" text NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingestion_sources" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"file_id" uuid,
	"source_type" varchar(30) NOT NULL,
	"source_url" text NOT NULL,
	"normalized_url" text,
	"extractor" varchar(50) NOT NULL,
	"extraction_status" varchar(20) NOT NULL,
	"extracted_pages" integer,
	"extracted_tokens" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_retrieval_runs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"thread_id" uuid,
	"message_id" uuid,
	"query_text" text NOT NULL,
	"vector_filter" jsonb,
	"top_k" integer DEFAULT 5,
	"score_threshold" real,
	"results_count" integer DEFAULT 0,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"thread_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"message_type" varchar(50),
	"system_message_type" varchar(50),
	"content" text NOT NULL,
	"content_timestamp" timestamp DEFAULT now() NOT NULL,
	"role" varchar(20) NOT NULL,
	"agent_name" varchar(50),
	"parent_message_id" uuid,
	"llm_model_id" uuid,
	"reaction" varchar(20),
	"source" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chatbot_system_errors" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"service" varchar(20) NOT NULL,
	"error_stage" varchar(20) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"user_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"thread_id" uuid,
	"message_id" uuid,
	"file_id" uuid,
	"chunk_id" uuid,
	"retrieval_run_id" uuid,
	"error_code" varchar(20),
	"error_message" text NOT NULL,
	"retryable" boolean DEFAULT false NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users_sessions" ADD CONSTRAINT "user_id" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_llm_models" ADD CONSTRAINT "fk_llm_subscription" FOREIGN KEY ("under_this_subscription_id") REFERENCES "public"."website_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbots" ADD CONSTRAINT "fk_user_chatbots_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbots" ADD CONSTRAINT "fk_user_chatbots_creator" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_team_members" ADD CONSTRAINT "fk_team_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_team_members" ADD CONSTRAINT "fk_team_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_invitations" ADD CONSTRAINT "fk_invite_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_invitations" ADD CONSTRAINT "fk_invite_user" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_subscriptions" ADD CONSTRAINT "fk_us_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_subscriptions" ADD CONSTRAINT "fk_us_subscription" FOREIGN KEY ("subscription_id") REFERENCES "public"."website_subscriptions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_addons_purchased" ADD CONSTRAINT "fk_uap_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_addons_purchased" ADD CONSTRAINT "fk_uap_addon" FOREIGN KEY ("addon_id") REFERENCES "public"."website_add_ons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_addons_purchased" ADD CONSTRAINT "fk_uap_subscription" FOREIGN KEY ("subscription_id") REFERENCES "public"."users_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_referrals" ADD CONSTRAINT "fk_referral_referrer" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_referrals" ADD CONSTRAINT "fk_referral_referred" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_referrals" ADD CONSTRAINT "fk_referral_promotion" FOREIGN KEY ("promotion_id") REFERENCES "public"."website_promotion_referral"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_llm_model_usage" ADD CONSTRAINT "fk_lmu_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_usage_tracking" ADD CONSTRAINT "fk_ut_llm_usage" FOREIGN KEY ("llm_usage_id") REFERENCES "public"."users_llm_model_usage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_usage_tracking" ADD CONSTRAINT "fk_ut_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_billing" ADD CONSTRAINT "fk_billing_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_billing" ADD CONSTRAINT "fk_billing_subscription" FOREIGN KEY ("subscription_purchased_id") REFERENCES "public"."website_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_billing" ADD CONSTRAINT "fk_billing_addon" FOREIGN KEY ("addon_purchased_id") REFERENCES "public"."website_add_ons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_billing" ADD CONSTRAINT "fk_billing_referral" FOREIGN KEY ("referral_id") REFERENCES "public"."users_referrals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_api_keys" ADD CONSTRAINT "fk_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_api_request_logs" ADD CONSTRAINT "fk_api_request_logs_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_api_request_logs" ADD CONSTRAINT "fk_api_request_logs_api_key" FOREIGN KEY ("api_key_id") REFERENCES "public"."users_api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_appearance_ui" ADD CONSTRAINT "fk_ui_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_behavior" ADD CONSTRAINT "fk_behavior_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_settings_general" ADD CONSTRAINT "fk_general_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cache_delete_requests" ADD CONSTRAINT "fk_cache_delete_requests_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cache_delete_requests" ADD CONSTRAINT "fk_cache_delete_requests_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_files" ADD CONSTRAINT "fk_ingestion_file_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_files" ADD CONSTRAINT "fk_ingestion_file_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_chunks" ADD CONSTRAINT "fk_ingestion_chunk_file" FOREIGN KEY ("file_id") REFERENCES "public"."ingestion_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_conversation_starters" ADD CONSTRAINT "fk_cs_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_custom_prompts" ADD CONSTRAINT "fk_custom_prompt_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_follow_up_prompts" ADD CONSTRAINT "fk_fup_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_settings_instruction" ADD CONSTRAINT "fk_instruction_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_personas" ADD CONSTRAINT "fk_persona_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_settings_localization_texts" ADD CONSTRAINT "fk_chatbot_integration" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_integrations" ADD CONSTRAINT "fk_integration_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_human_support_settings" ADD CONSTRAINT "fk_human_support_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_leads_settings" ADD CONSTRAINT "fk_lead_settings_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_threads" ADD CONSTRAINT "fk_thread_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_threads" ADD CONSTRAINT "fk_thread_customer" FOREIGN KEY ("chat_user_id") REFERENCES "public"."user_chatbot_chatting_customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_status_logs" ADD CONSTRAINT "fk_ingestion_status_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_status_logs" ADD CONSTRAINT "fk_ingestion_status_file" FOREIGN KEY ("file_id") REFERENCES "public"."ingestion_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_status_logs" ADD CONSTRAINT "fk_ingestion_status_chunk" FOREIGN KEY ("chunk_id") REFERENCES "public"."ingestion_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "fk_ingestion_error_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "fk_ingestion_error_file" FOREIGN KEY ("file_id") REFERENCES "public"."ingestion_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_errors" ADD CONSTRAINT "fk_ingestion_error_chunk" FOREIGN KEY ("chunk_id") REFERENCES "public"."ingestion_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_sources" ADD CONSTRAINT "fk_ingestion_source_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_sources" ADD CONSTRAINT "fk_ingestion_source_file" FOREIGN KEY ("file_id") REFERENCES "public"."ingestion_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_retrieval_runs" ADD CONSTRAINT "fk_retrieval_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_retrieval_runs" ADD CONSTRAINT "fk_retrieval_thread" FOREIGN KEY ("thread_id") REFERENCES "public"."user_chatbot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_messages" ADD CONSTRAINT "fk_message_llm_model" FOREIGN KEY ("llm_model_id") REFERENCES "public"."website_llm_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_messages" ADD CONSTRAINT "fk_message_thread" FOREIGN KEY ("thread_id") REFERENCES "public"."user_chatbot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_messages" ADD CONSTRAINT "fk_message_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_system_errors" ADD CONSTRAINT "fk_error_user" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_system_errors" ADD CONSTRAINT "fk_error_chatbot" FOREIGN KEY ("chatbot_id") REFERENCES "public"."user_chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_system_errors" ADD CONSTRAINT "fk_error_thread" FOREIGN KEY ("thread_id") REFERENCES "public"."user_chatbot_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_system_errors" ADD CONSTRAINT "fk_error_message" FOREIGN KEY ("message_id") REFERENCES "public"."user_chatbot_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_system_errors" ADD CONSTRAINT "fk_error_file" FOREIGN KEY ("file_id") REFERENCES "public"."ingestion_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chatbot_system_errors" ADD CONSTRAINT "fk_error_chunk" FOREIGN KEY ("chunk_id") REFERENCES "public"."ingestion_chunks"("id") ON DELETE cascade ON UPDATE no action;
*/