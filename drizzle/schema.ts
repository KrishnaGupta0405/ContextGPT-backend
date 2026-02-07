import { pgTable, foreignKey, uuid, varchar, integer, text, timestamp, jsonb, check, unique, boolean, real, numeric, smallint, inet, bigint, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const ingestionFiles = pgTable("ingestion_files", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	userId: uuid("user_id").notNull(),
	fileName: varchar("file_name", { length: 255 }).notNull(),
	fileType: varchar("file_type", { length: 50 }).notNull(),
	fileSize: integer("file_size").notNull(),
	fileTokens: integer("file_tokens"),
	filePages: integer("file_pages"),
	fileSource: varchar("file_source", { length: 50 }).notNull(),
	origin: varchar({ length: 20 }).notNull(),
	sourceId: uuid("source_id"),
	storageUri: text("storage_uri").notNull(),
	totalChunks: integer("total_chunks").default(0).notNull(),
	status: varchar({ length: 20 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	objectKey: text("object_key").notNull(),
	ingestionFirecrawlBatchJobsId: uuid("ingestion_firecrawl_batch_jobs_id"),
}, (table) => [
	foreignKey({
			columns: [table.ingestionFirecrawlBatchJobsId],
			foreignColumns: [ingestionFirecrawlBatchJobs.id],
			name: "fk_ingestion_firecrawl_batch_jobs"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_ingestion_file_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_ingestion_file_user"
		}).onDelete("cascade"),
]);

export const ingestionSources = pgTable("ingestion_sources", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	fileId: uuid("file_id"),
	sourceType: varchar("source_type", { length: 30 }).notNull(),
	sourceUrl: text("source_url").notNull(),
	normalizedUrl: text("normalized_url"),
	extractor: varchar({ length: 50 }).notNull(),
	extractionStatus: varchar("extraction_status", { length: 20 }).notNull(),
	extractedPages: integer("extracted_pages"),
	extractedTokens: integer("extracted_tokens"),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_ingestion_source_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [ingestionFiles.id],
			name: "fk_ingestion_source_file"
		}).onDelete("set null"),
]);

export const ingestionStatusLogs = pgTable("ingestion_status_logs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	entityType: varchar("entity_type", { length: 20 }).notNull(),
	fileId: uuid("file_id"),
	chunkId: uuid("chunk_id"),
	sourceId: uuid("source_id"),
	status: varchar({ length: 50 }).notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_ingestion_status_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [ingestionFiles.id],
			name: "fk_ingestion_status_file"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chunkId],
			foreignColumns: [ingestionChunks.id],
			name: "fk_ingestion_status_chunk"
		}).onDelete("cascade"),
	check("chk_exactly_one_entity", sql`(((entity_type)::text = 'FILE'::text) AND (file_id IS NOT NULL) AND (chunk_id IS NULL) AND (source_id IS NULL)) OR (((entity_type)::text = 'CHUNK'::text) AND (chunk_id IS NOT NULL) AND (file_id IS NULL) AND (source_id IS NULL)) OR (((entity_type)::text = 'SOURCE'::text) AND (source_id IS NOT NULL) AND (file_id IS NULL) AND (chunk_id IS NULL))`),
]);

export const userChatbotAppearanceUi = pgTable("user_chatbot_appearance_ui", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	tooltip: text(),
	welcomeMessage: text("welcome_message"),
	inputPlaceholderText: text("input_placeholder_text"),
	brandPrimaryColor: varchar("brand_primary_color", { length: 7 }),
	brandTextColor: varchar("brand_text_color", { length: 7 }),
	brandIconBgColor: varchar("brand_icon_bg_color", { length: 7 }),
	showBackground: boolean("show_background").default(true),
	linkColor: varchar("link_color", { length: 7 }),
	fontSize: integer("font_size"),
	chatHeight: integer("chat_height"),
	externalLink: text("external_link"),
	iconSize: varchar("icon_size", { length: 20 }),
	iconPosition: varchar("icon_position", { length: 20 }),
	defaultMode: varchar("default_mode", { length: 20 }),
	watermarkBrandIcon: text("watermark_brand_icon"),
	watermarkBrandText: text("watermark_brand_text"),
	watermarkBrandLink: text("watermark_brand_link"),
	watermarkBrandInfoShow: boolean("watermark_brand_info_show").default(true),
	hideWatermarkSitegpt: boolean("hide_watermark_sitegpt").default(false),
	rightToLeftMode: boolean("right_to_left_mode").default(false),
	enableDarkMode: boolean("enable_dark_mode").default(false),
	distanceFromBottom: integer("distance_from_bottom"),
	horizontalDistance: integer("horizontal_distance"),
	botIconSrc: varchar("bot_icon_src", { length: 64 }),
	userIconSrc: varchar("user_icon_src", { length: 64 }),
	agentIconSrc: varchar("agent_icon_src", { length: 64 }),
	bubbleIconSrc: varchar("bubble_icon_src", { length: 64 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_ui_chatbot"
		}).onDelete("cascade"),
	unique("user_chatbot_appearance_ui_chatbot_id_key").on(table.chatbotId),
]);

export const userChatbotBehavior = pgTable("user_chatbot_behavior", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	hideSources: boolean("hide_sources").default(false),
	hideTooltip: boolean("hide_tooltip").default(false),
	hideFeedbackButtons: boolean("hide_feedback_buttons").default(false),
	hideBottomNavigation: boolean("hide_bottom_navigation").default(false),
	hideRefreshButton: boolean("hide_refresh_button").default(false),
	hideExpandButton: boolean("hide_expand_button").default(false),
	hideHomePage: boolean("hide_home_page").default(false),
	stayOnHomePage: boolean("stay_on_home_page").default(false),
	requireTermsAcceptance: boolean("require_terms_acceptance").default(false),
	disclaimerText: text("disclaimer_text"),
	autoOpenChatDesktop: boolean("auto_open_chat_desktop").default(false),
	autoOpenChatDesktopDelay: integer("auto_open_chat_desktop_delay"),
	autoOpenChatMobile: boolean("auto_open_chat_mobile").default(false),
	autoOpenChatMobileDelay: integer("auto_open_chat_mobile_delay"),
	smartFollowUpPromptsCount: integer("smart_follow_up_prompts_count"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_behavior_chatbot"
		}).onDelete("cascade"),
	unique("user_chatbot_behavior_chatbot_id_key").on(table.chatbotId),
]);

export const userChatbotConversationStarters = pgTable("user_chatbot_conversation_starters", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	buttonMessage: text("button_message").notNull(),
	linkText: varchar("link_text", { length: 255 }),
	linkSrc: text("link_src"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_cs_chatbot"
		}).onDelete("cascade"),
]);

export const userChatbotChattingCustomers = pgTable("user_chatbot_chatting_customers", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	email: varchar({ length: 255 }),
	name: varchar({ length: 255 }),
	phoneNumber: varchar("phone_number", { length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const userChatbotFollowUpPrompts = pgTable("user_chatbot_follow_up_prompts", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	buttonTitle: varchar("button_title", { length: 255 }),
	buttonMessage: text("button_message"),
	linkText: varchar("link_text", { length: 255 }),
	linkSrc: text("link_src"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_fup_chatbot"
		}).onDelete("cascade"),
]);

export const userChatbotHumanSupportSettings = pgTable("user_chatbot_human_support_settings", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	enableHumanSupport: boolean("enable_human_support").default(false),
	replaceAllOtherSuggestionsWithEscalationButtons: boolean("replace_all_other_suggestions_with_escalation_buttons").default(false),
	positiveFeedbackPrompt: text("positive_feedback_prompt"),
	requestHumanSupportPrompt: text("request_human_support_prompt"),
	humanSupportConfirmationMessage: text("human_support_confirmation_message"),
	leadNotification: boolean("lead_notification").default(false),
	leadNotificationEmail: text("lead_notification_email").array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_human_support_chatbot"
		}).onDelete("cascade"),
]);

export const userChatbotIntegrations = pgTable("user_chatbot_integrations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	platformType: varchar("platform_type", { length: 30 }).notNull(),
	config: jsonb().notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_integration_chatbot"
		}).onDelete("cascade"),
	check("chk_platform_type", sql`(platform_type)::text = ANY (ARRAY[('SLACK'::character varying)::text, ('MESSENGER'::character varying)::text, ('CRISP'::character varying)::text, ('ZOHO_SALES_IQ'::character varying)::text])`),
]);

export const userChatbotCustomPrompts = pgTable("user_chatbot_custom_prompts", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	title: varchar({ length: 255 }).notNull(),
	description: text(),
	instructions: text().notNull(),
	temperature: real(),
	deletable: boolean().default(false),
	creativityLevel: real("creativity_level"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_custom_prompt_chatbot"
		}).onDelete("cascade"),
]);

export const userChatbotLeadsSettings = pgTable("user_chatbot_leads_settings", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	enableLeadCollection: boolean("enable_lead_collection").default(false),
	customerNameTake: boolean("customer_name_take").default(false),
	customerName: text("customer_name"),
	customerPhoneTake: boolean("customer_phone_take").default(false),
	customerPhone: text("customer_phone"),
	customerEmailTake: boolean("customer_email_take").default(true).notNull(),
	customerEmail: text("customer_email"),
	industryTemplate: text("industry_template"),
	whenToCollectLead: text("when_to_collect_lead"),
	customerTriggerKeywords: text("customer_trigger_keywords"),
	customerFormField: jsonb("customer_form_field"),
	bookingIntegration: boolean("booking_integration").default(false),
	bookingIntegrationLink: text("booking_integration_link"),
	leadNotification: boolean("lead_notification").default(false),
	leadNotificationEmail: text("lead_notification_email").array(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_lead_settings_chatbot"
		}).onDelete("cascade"),
	check("chk_when_to_collect_lead", sql`(when_to_collect_lead IS NULL) OR (when_to_collect_lead = ANY (ARRAY['interest'::text, 'unable_to_answer'::text, 'after_n_messages'::text]))`),
]);

export const userChatbotPersonas = pgTable("user_chatbot_personas", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	title: varchar({ length: 50 }).notNull(),
	description: text(),
	instructions: text().notNull(),
	creativityLevel: real("creativity_level").default(0.5).notNull(),
	deletable: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_persona_chatbot"
		}).onDelete("cascade"),
]);

export const userChatbotRetrievalRuns = pgTable("user_chatbot_retrieval_runs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	threadId: uuid("thread_id"),
	messageId: uuid("message_id"),
	queryText: text("query_text").notNull(),
	vectorFilter: jsonb("vector_filter"),
	topK: integer("top_k").default(5),
	scoreThreshold: real("score_threshold"),
	resultsCount: integer("results_count").default(0),
	latencyMs: integer("latency_ms"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_retrieval_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [userChatbotThreads.id],
			name: "fk_retrieval_thread"
		}).onDelete("cascade"),
]);

export const userChatbotSettingsGeneral = pgTable("user_chatbot_settings_general", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	description: text(),
	disableSmartFollowup: boolean("disable_smart_followup").default(false),
	numberOfSmartFollowupQuestionShown: integer("number_of_smart_followup_question_shown"),
	enablePageContextAwareness: boolean("enable_page_context_awareness").default(false),
	historyMessageContext: integer("history_message_context"),
	llmModel: varchar("llm_model", { length: 50 }),
	limitMessagesPerConversation: boolean("limit_messages_per_conversation").default(false),
	maxMessagesPerConversation: integer("max_messages_per_conversation"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_general_chatbot"
		}).onDelete("cascade"),
	unique("user_chatbot_settings_general_chatbot_id_key").on(table.chatbotId),
]);

export const userChatbotSettingsInstruction = pgTable("user_chatbot_settings_instruction", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	title: varchar({ length: 100 }),
	instruction: text().notNull(),
	creativityLevel: real("creativity_level").default(0.5).notNull(),
	deletable: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_instruction_chatbot"
		}).onDelete("cascade"),
	unique("user_chatbot_settings_instruction_chatbot_id_key").on(table.chatbotId),
]);

export const userChatbotSettingsLocalizationTexts = pgTable("user_chatbot_settings_localization_texts", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	homeTitle: text("home_title"),
	homeDescription: text("home_description"),
	addDetails: text("add_details"),
	startConversation: text("start_conversation"),
	starting: text(),
	messagesTitle: text("messages_title"),
	messagesDescription: text("messages_description"),
	noMessages: text("no_messages"),
	verifyEmailMessage: text("verify_email_message"),
	conversationHistoryInfo: text("conversation_history_info"),
	botLabel: text("bot_label"),
	youLabel: text("you_label"),
	agentLabel: text("agent_label"),
	escalateConfirmation: text("escalate_confirmation"),
	escalateDescription: text("escalate_description"),
	yesContinue: text("yes_continue"),
	cancel: text(),
	switchedToHuman: text("switched_to_human"),
	startNewConversation: text("start_new_conversation"),
	maxMessagesTitle: text("max_messages_title"),
	maxMessagesDescription: text("max_messages_description"),
	connected: text(),
	disconnected: text(),
	connecting: text(),
	disconnecting: text(),
	reconnect: text(),
	accountTitle: text("account_title"),
	verifyEmailTitle: text("verify_email_title"),
	verifyEmailDescription: text("verify_email_description"),
	emailLabel: text("email_label"),
	nameLabel: text("name_label"),
	phoneLabel: text("phone_label"),
	submitButton: text("submit_button"),
	sendingOtp: text("sending_otp"),
	verifyOtp: text("verify_otp"),
	otpSentMessage: text("otp_sent_message"),
	otpLabel: text("otp_label"),
	verifyContinue: text("verify_continue"),
	resendOtp: text("resend_otp"),
	editDetails: text("edit_details"),
	resetting: text(),
	verifying: text(),
	logout: text(),
	loggingOut: text("logging_out"),
	verified: text(),
	edit: text(),
	update: text(),
	updating: text(),
	leadFormTitle: text("lead_form_title"),
	leadFormDescription: text("lead_form_description"),
	formHeading: text("form_heading"),
	formSubmittedMessage: text("form_submitted_message"),
	continueButton: text("continue_button"),
	submittingText: text("submitting_text"),
	inputDisabledPlaceholder: text("input_disabled_placeholder"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_chatbot_integration"
		}).onDelete("cascade"),
]);

export const userChatbotSystemErrors = pgTable("user_chatbot_system_errors", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	service: varchar({ length: 20 }).notNull(),
	errorStage: varchar("error_stage", { length: 20 }).notNull(),
	severity: varchar({ length: 20 }).notNull(),
	userId: uuid("user_id").notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	threadId: uuid("thread_id"),
	messageId: uuid("message_id"),
	fileId: uuid("file_id"),
	chunkId: uuid("chunk_id"),
	retrievalRunId: uuid("retrieval_run_id"),
	errorCode: varchar("error_code", { length: 20 }),
	errorMessage: text("error_message").notNull(),
	retryable: boolean().default(false).notNull(),
	resolved: boolean().default(false).notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_error_user"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_error_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [userChatbotThreads.id],
			name: "fk_error_thread"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [userChatbotMessages.id],
			name: "fk_error_message"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [ingestionFiles.id],
			name: "fk_error_file"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chunkId],
			foreignColumns: [ingestionChunks.id],
			name: "fk_error_chunk"
		}).onDelete("cascade"),
]);

export const userChatbotMessages = pgTable("user_chatbot_messages", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	threadId: uuid("thread_id").notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	messageType: varchar("message_type", { length: 50 }),
	systemMessageType: varchar("system_message_type", { length: 50 }),
	content: text().notNull(),
	contentTimestamp: timestamp("content_timestamp", { mode: 'string' }).defaultNow().notNull(),
	role: varchar({ length: 20 }).notNull(),
	agentName: varchar("agent_name", { length: 50 }),
	parentMessageId: uuid("parent_message_id"),
	llmModelId: uuid("llm_model_id"),
	reaction: varchar({ length: 20 }),
	source: varchar({ length: 50 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_message_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.llmModelId],
			foreignColumns: [websiteLlmModels.id],
			name: "fk_message_llm_model"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.threadId],
			foreignColumns: [userChatbotThreads.id],
			name: "fk_message_thread"
		}).onDelete("cascade"),
]);

export const usersApiKeys = pgTable("users_api_keys", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	apiKey: varchar("api_key", { length: 255 }).notNull(),
	lastUsedAt: timestamp("last_used_at", { mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_api_keys_user"
		}).onDelete("cascade"),
	unique("users_api_keys_api_key_key").on(table.apiKey),
]);

export const users = pgTable("users", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	email: varchar({ length: 50 }).notNull(),
	name: varchar({ length: 50 }),
	avatar: text(),
	facebookLink: text("facebook_link"),
	instagramLink: text("instagram_link"),
	linkedinLink: text("linkedin_link"),
	twitterLink: text("twitter_link"),
	youtubeLink: text("youtube_link"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	password: text().notNull(),
}, (table) => [
	unique("users_email_key").on(table.email),
]);

export const userChatbotThreads = pgTable("user_chatbot_threads", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	chatUserId: uuid("chat_user_id"),
	unreadMessagesCount: integer("unread_messages_count").default(0).notNull(),
	webhookUrl: text("webhook_url"),
	webhookToken: text("webhook_token"),
	escalated: boolean().default(false).notNull(),
	important: boolean().default(false).notNull(),
	resolved: boolean().default(false).notNull(),
	archived: boolean().default(false).notNull(),
	tags: jsonb(),
	positiveCount: integer("positive_count").default(0).notNull(),
	negativeCount: integer("negative_count").default(0).notNull(),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	endedAt: timestamp("ended_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_thread_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatUserId],
			foreignColumns: [userChatbotChattingCustomers.id],
			name: "fk_thread_customer"
		}).onDelete("set null"),
]);

export const userChatbots = pgTable("user_chatbots", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	accountId: uuid("account_id").notNull(),
	createdById: uuid("created_by_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	name: varchar({ length: 100 }).notNull(),
	vectorNamespace: text("vector_namespace"),
	vectorIndexVersion: integer("vector_index_version").default(1),
}, (table) => [
	foreignKey({
			columns: [table.createdById],
			foreignColumns: [users.id],
			name: "fk_user_chatbots_creator"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "fk_user_chatbots_account"
		}).onDelete("cascade"),
	unique("unique_account_chatbot_name").on(table.accountId, table.name),
]);

export const websiteAddOns = pgTable("website_add_ons", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	title: text().notNull(),
	price: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	paddlePriceId: text("paddle_price_id"),
}, (table) => [
	unique("website_add_ons_paddle_price_id_key").on(table.paddlePriceId),
]);

export const paddleTransactions = pgTable("paddle_transactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	paddleTransactionId: text("paddle_transaction_id").notNull(),
	paddleSubscriptionId: text("paddle_subscription_id"),
	status: varchar({ length: 30 }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	currency: varchar({ length: 3 }).notNull(),
	billingPeriodStart: timestamp("billing_period_start", { withTimezone: true, mode: 'string' }),
	billingPeriodEnd: timestamp("billing_period_end", { withTimezone: true, mode: 'string' }),
	receiptUrl: text("receipt_url"),
	invoiceUrl: text("invoice_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_pt_user"
		}).onDelete("cascade"),
	unique("paddle_transactions_paddle_transaction_id_key").on(table.paddleTransactionId),
]);

export const websiteLlmModels = pgTable("website_llm_models", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	provider: varchar({ length: 50 }).notNull(),
	title: varchar({ length: 100 }).notNull(),
	underThisSubscriptionId: uuid("under_this_subscription_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	inputCostPer1K: numeric("input_cost_per_1k", { precision: 10, scale:  6 }),
	outputCostPer1K: numeric("output_cost_per_1k", { precision: 10, scale:  6 }),
	isActive: boolean("is_active").default(true).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.underThisSubscriptionId],
			foreignColumns: [websiteSubscriptions.id],
			name: "fk_llm_subscription"
		}).onDelete("cascade"),
]);

export const accounts = pgTable("accounts", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	ownerId: uuid("owner_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [users.id],
			name: "fk_account_owner"
		}).onDelete("cascade"),
	unique("uq_account_name").on(table.name),
]);

export const accountInvitations = pgTable("account_invitations", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	accountId: uuid("account_id").notNull(),
	email: varchar({ length: 50 }).notNull(),
	role: varchar({ length: 20 }).notNull(),
	invitedById: uuid("invited_by_id").notNull(),
	token: varchar({ length: 20 }).notNull(),
	status: varchar({ length: 20 }).default('PENDING'),
	expiresAt: timestamp("expires_at", { mode: 'string' }).default(sql`(now() + '7 days'::interval)`),
	scope: varchar({ length: 20 }).default('ACCOUNT'),
	resourceId: uuid("resource_id"),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "fk_ai_account"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.invitedById],
			foreignColumns: [users.id],
			name: "fk_ai_inviter"
		}),
	unique("account_invitations_token_key").on(table.token),
	check("chk_ai_status", sql`(status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'EXPIRED'::character varying])::text[])`),
	check("chk_ai_scope", sql`(scope)::text = ANY ((ARRAY['ACCOUNT'::character varying, 'CHATBOT'::character varying])::text[])`),
]);

export const usersSessions = pgTable("users_sessions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	refreshToken: text("refresh_token"),
	deviceInfo: text("device_info"),
	ipAddress: text("ip_address"),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	isRevoked: boolean("is_revoked").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_users_sessions_user"
		}).onDelete("cascade"),
]);

export const accountMembers = pgTable("account_members", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	accountId: uuid("account_id").notNull(),
	userId: uuid("user_id").notNull(),
	role: varchar({ length: 20 }).notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.accountId],
			foreignColumns: [accounts.id],
			name: "fk_am_account"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_am_user"
		}).onDelete("cascade"),
	unique("uq_account_user").on(table.accountId, table.userId),
	check("chk_account_role", sql`(role)::text = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'AGENT'::character varying])::text[])`),
]);

export const paddleWebhookEvents = pgTable("paddle_webhook_events", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	eventId: text("event_id").notNull(),
	eventType: varchar("event_type", { length: 100 }).notNull(),
	paddleSubscriptionId: text("paddle_subscription_id"),
	paddleCustomerId: text("paddle_customer_id"),
	paddleTransactionId: text("paddle_transaction_id"),
	payload: jsonb().notNull(),
	processed: boolean().default(false),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	errorMessage: text("error_message"),
	retryCount: integer("retry_count").default(0),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	idempotencyKey: text("idempotency_key"),
}, (table) => [
	unique("paddle_webhook_events_event_id_key").on(table.eventId),
	unique("paddle_webhook_events_idempotency_key_key").on(table.idempotencyKey),
]);

export const ingestionChunks = pgTable("ingestion_chunks", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	fileId: uuid("file_id").notNull(),
	chunkIndex: integer("chunk_index").notNull(),
	objectKey: text("object_key").notNull(),
	chunkTextPreviewLink: text("chunk_text_preview_link"),
	tokenCount: integer("token_count").notNull(),
	embeddingStatus: varchar("embedding_status", { length: 20 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	vectorId: text("vector_id"),
	vectorNamespace: text("vector_namespace"),
	vectorMetadata: jsonb("vector_metadata"),
	pageNumber: integer("page_number"),
}, (table) => [
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [ingestionFiles.id],
			name: "fk_ingestion_chunk_file"
		}).onDelete("cascade"),
	unique("uq_file_chunk_index").on(table.fileId, table.chunkIndex),
]);

export const usersSubscriptions = pgTable("users_subscriptions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	paddleSubscriptionId: text("paddle_subscription_id"),
	paddleCustomerId: text("paddle_customer_id").notNull(),
	status: varchar({ length: 30 }).notNull(),
	currentPeriodStart: timestamp("current_period_start", { withTimezone: true, mode: 'string' }).notNull(),
	currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: 'string' }).notNull(),
	trialEndsAt: timestamp("trial_ends_at", { withTimezone: true, mode: 'string' }),
	nextBilledAt: timestamp("next_billed_at", { withTimezone: true, mode: 'string' }),
	pausedAt: timestamp("paused_at", { withTimezone: true, mode: 'string' }),
	canceledAt: timestamp("canceled_at", { withTimezone: true, mode: 'string' }),
	endsAt: timestamp("ends_at", { withTimezone: true, mode: 'string' }),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	scheduledChange: jsonb("scheduled_change"),
	maxChatbotsAllowed: integer("max_chatbots_allowed").notNull(),
	maxPagesAllowed: integer("max_pages_allowed").notNull(),
	teamMemberAccess: integer("team_member_access").notNull(),
	apiAccess: boolean("api_access").notNull(),
	autoSyncData: boolean("auto_sync_data").notNull(),
	webhookSupport: boolean("webhook_support").notNull(),
	userMessageRateLimit: integer("user_message_rate_limit").notNull(),
	bonusMessages: integer("bonus_messages").default(0),
	bonusPages: integer("bonus_pages").default(0),
	expiryDate: timestamp("expiry_date", { mode: 'string' }),
	currency: varchar({ length: 3 }).default('USD'),
	totalPrice: numeric("total_price", { precision: 12, scale:  2 }),
	managementUrls: jsonb("management_urls"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	paddleTransactionId: text("paddle_transaction_id"),
	billingInterval: varchar("billing_interval", { length: 20 }),
	billingIntervalCount: integer("billing_interval_count").default(1),
	collectionMode: varchar("collection_mode", { length: 20 }).default('automatic'),
	bonusTitle: varchar("bonus_title", { length: 100 }),
	isTrial: boolean("is_trial").default(false).notNull(),
	trialStartedAt: timestamp("trial_started_at", { withTimezone: true, mode: 'string' }),
	trialPagesUsed: integer("trial_pages_used").default(0),
	trialMessagesUsed: integer("trial_messages_used").default(0),
	trialChatbotsUsed: integer("trial_chatbots_used").default(0),
	trialPagesLimit: integer("trial_pages_limit").default(0),
	trialMessagesLimit: integer("trial_messages_limit").default(0),
	trialChatbotsLimit: integer("trial_chatbots_limit").default(0),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_us_user"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [websiteSubscriptions.id],
			name: "fk_us_subscription"
		}).onDelete("restrict"),
	unique("users_subscriptions_paddle_subscription_id_key").on(table.paddleSubscriptionId),
	check("users_subscriptions_status_check", sql`(status)::text = ANY ((ARRAY['incomplete'::character varying, 'trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'paused'::character varying, 'canceled'::character varying])::text[])`),
	check("users_subscriptions_billing_interval_check", sql`(billing_interval)::text = ANY ((ARRAY['month'::character varying, 'year'::character varying])::text[])`),
	check("users_subscriptions_collection_mode_check", sql`(collection_mode)::text = ANY ((ARRAY['automatic'::character varying, 'manual'::character varying])::text[])`),
]);

export const rateLimitRules = pgTable("rate_limit_rules", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	subjectType: varchar("subject_type", { length: 20 }).notNull(),
	subjectId: uuid("subject_id").notNull(),
	limitType: varchar("limit_type", { length: 40 }).notNull(),
	modelName: varchar("model_name", { length: 100 }),
	windowSeconds: integer("window_seconds").notNull(),
	maxValue: integer("max_value").notNull(),
	isEnabled: boolean("is_enabled").default(true).notNull(),
	priority: smallint().default(0),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("uq_rate_limit_rule").on(table.subjectType, table.subjectId, table.limitType, table.modelName, table.windowSeconds),
	check("rate_limit_rules_subject_type_check", sql`(subject_type)::text = ANY ((ARRAY['USER'::character varying, 'API_KEY'::character varying, 'CHATBOT'::character varying])::text[])`),
	check("rate_limit_rules_limit_type_check", sql`(limit_type)::text = ANY ((ARRAY['messages'::character varying, 'tokens'::character varying, 'pages_indexed'::character varying, 'chatbot_creations'::character varying])::text[])`),
	check("rate_limit_rules_window_seconds_check", sql`window_seconds > 0`),
	check("rate_limit_rules_max_value_check", sql`max_value >= 0`),
]);

export const usersApiRequestLogs = pgTable("users_api_request_logs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	apiKeyId: uuid("api_key_id").notNull(),
	endpoint: varchar({ length: 255 }).notNull(),
	method: varchar({ length: 10 }).notNull(),
	statusCode: integer("status_code").notNull(),
	requestIp: inet("request_ip"),
	userAgent: text("user_agent"),
	requestTimestamp: timestamp("request_timestamp", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	responseTimestamp: timestamp("response_timestamp", { withTimezone: true, mode: 'string' }),
	durationMs: integer("duration_ms").generatedAlwaysAs(sql`(EXTRACT(epoch FROM (response_timestamp - request_timestamp)) * (1000)::numeric)`),
	requestSizeBytes: integer("request_size_bytes"),
	responseSizeBytes: integer("response_size_bytes"),
	tokensUsed: integer("tokens_used"),
	llmModelId: uuid("llm_model_id"),
	rateLimitKey: varchar("rate_limit_key", { length: 100 }),
	rateLimited: boolean("rate_limited").default(false).notNull(),
	retryAfter: integer("retry_after"),
	error: boolean().default(false).notNull(),
	errorMessage: text("error_message"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_api_request_logs_user"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [usersApiKeys.id],
			name: "fk_api_request_logs_api_key"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.llmModelId],
			foreignColumns: [websiteLlmModels.id],
			name: "fk_api_request_logs_model"
		}).onDelete("set null"),
]);

export const usersRateLimitConsumption = pgTable("users_rate_limit_consumption", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	ruleId: uuid("rule_id").notNull(),
	subjectId: uuid("subject_id").notNull(),
	limitType: varchar("limit_type", { length: 40 }).notNull(),
	consumedValue: integer("consumed_value").default(0).notNull(),
	windowStart: timestamp("window_start", { withTimezone: true, mode: 'string' }).notNull(),
	windowEnd: timestamp("window_end", { withTimezone: true, mode: 'string' }).notNull(),
	metadata: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.ruleId],
			foreignColumns: [rateLimitRules.id],
			name: "fk_consumption_rule"
		}).onDelete("cascade"),
]);

export const usersLlmUsageEvents = pgTable("users_llm_usage_events", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	threadId: uuid("thread_id"),
	messageId: uuid("message_id").notNull(),
	llmModelId: uuid("llm_model_id").notNull(),
	inputTokens: integer("input_tokens").notNull(),
	outputTokens: integer("output_tokens").notNull(),
	totalTokens: integer("total_tokens").generatedAlwaysAs(sql`(input_tokens + output_tokens)`),
	cost: numeric({ precision: 10, scale:  6 }).notNull(),
	latencyMs: integer("latency_ms"),
	finishReason: varchar("finish_reason", { length: 20 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_usage_event_user"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_usage_event_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.messageId],
			foreignColumns: [userChatbotMessages.id],
			name: "fk_usage_event_message"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.llmModelId],
			foreignColumns: [websiteLlmModels.id],
			name: "fk_usage_event_model"
		}).onDelete("restrict"),
]);

export const usersUsageTracking = pgTable("users_usage_tracking", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	subscriptionId: uuid("subscription_id").notNull(),
	periodStart: timestamp("period_start", { withTimezone: true, mode: 'string' }).notNull(),
	periodEnd: timestamp("period_end", { withTimezone: true, mode: 'string' }).notNull(),
	chatbotsCreated: integer("chatbots_created").default(0).notNull(),
	messagesSent: integer("messages_sent").default(0).notNull(),
	messagesReceived: integer("messages_received").default(0).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalTokens: bigint("total_tokens", { mode: "number" }).default(0).notNull(),
	pagesIndexed: integer("pages_indexed").default(0).notNull(),
	teamMembersAdded: integer("team_members_added").default(0).notNull(),
	limitChatbots: integer("limit_chatbots").notNull(),
	limitMessages: integer("limit_messages").notNull(),
	limitPages: integer("limit_pages").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_ut_user"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [usersSubscriptions.id],
			name: "fk_ut_subscription"
		}).onDelete("cascade"),
	unique("uq_user_period").on(table.userId, table.periodStart),
]);

export const websitePromotionReferral = pgTable("website_promotion_referral", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	promotionShareText: text("promotion_share_text").notNull(),
	promoCode: varchar("promo_code", { length: 20 }),
	messageAdded: integer("message_added").default(0),
	pagesAdded: integer("pages_added").default(0),
	rewardTarget: varchar("reward_target", { length: 20 }).default('BOTH').notNull(),
	milestoneRewards: jsonb("milestone_rewards").default([]),
	isActive: boolean("is_active").default(true).notNull(),
	targetAudience: varchar("target_audience", { length: 20 }).notNull(),
	cycleType: varchar("cycle_type", { length: 20 }).default('LIFETIME').notNull(),
	signupMessagesBonus: integer("signup_messages_bonus").default(0),
	signupPagesBonus: integer("signup_pages_bonus").default(0),
	startsAt: timestamp("starts_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	promotionType: varchar("promotion_type", { length: 20 }).default('REFERRAL'),
	createdBy: uuid("created_by"),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.createdBy],
			foreignColumns: [users.id],
			name: "website_promotion_referral_created_by_fkey"
		}),
	unique("website_promotion_referral_promo_code_key").on(table.promoCode),
	check("website_promotion_referral_reward_target_check", sql`(reward_target)::text = ANY ((ARRAY['REFERRER'::character varying, 'REFERRED'::character varying, 'BOTH'::character varying, 'NONE'::character varying])::text[])`),
	check("website_promotion_referral_target_audience_check", sql`(target_audience)::text = ANY ((ARRAY['NEW_USERS'::character varying, 'EXISTING_USERS'::character varying, 'ALL'::character varying])::text[])`),
	check("website_promotion_referral_cycle_type_check", sql`(cycle_type)::text = ANY ((ARRAY['LIFETIME'::character varying, 'MONTHLY'::character varying, 'WEEKLY'::character varying])::text[])`),
	check("website_promotion_referral_promotion_type_check", sql`(promotion_type)::text = ANY ((ARRAY['REFERRAL'::character varying, 'DIRECT'::character varying])::text[])`),
]);

export const vectorPurgeRequests = pgTable("vector_purge_requests", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	fileId: uuid("file_id"),
	namespace: text(),
	status: varchar({ length: 20 }).default('PENDING'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	error: text(),
});

export const usersPromotionReferrals = pgTable("users_promotion_referrals", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	referrerUserId: uuid("referrer_user_id").notNull(),
	referredUserId: uuid("referred_user_id").notNull(),
	promotionId: uuid("promotion_id").notNull(),
	cycleKey: date("cycle_key").notNull(),
	redeemedAt: timestamp("redeemed_at", { mode: 'string' }).defaultNow().notNull(),
	status: varchar({ length: 20 }).default('PENDING').notNull(),
	confirmedAt: timestamp("confirmed_at", { mode: 'string' }),
	referrerMessages: integer("referrer_messages").default(0),
	referrerPages: integer("referrer_pages").default(0),
	referredMessages: integer("referred_messages").default(0),
	referredPages: integer("referred_pages").default(0),
	triggeredMilestones: jsonb("triggered_milestones").default([]),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	subscriptionId: uuid("subscription_id"),
}, (table) => [
	foreignKey({
			columns: [table.referrerUserId],
			foreignColumns: [users.id],
			name: "users_promotion_referrals_referrer_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.referredUserId],
			foreignColumns: [users.id],
			name: "users_promotion_referrals_referred_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.promotionId],
			foreignColumns: [websitePromotionReferral.id],
			name: "users_promotion_referrals_promotion_id_fkey"
		}).onDelete("restrict"),
	foreignKey({
			columns: [table.subscriptionId],
			foreignColumns: [usersSubscriptions.id],
			name: "fk_upr_subscription"
		}).onDelete("restrict"),
	unique("uq_unique_referral_per_cycle").on(table.referrerUserId, table.referredUserId, table.promotionId, table.cycleKey),
	unique("uq_referred_once_per_promo").on(table.referredUserId, table.promotionId),
	check("chk_no_self_referral", sql`referrer_user_id <> referred_user_id`),
	check("users_promotion_referrals_status_check", sql`(status)::text = ANY ((ARRAY['PENDING'::character varying, 'SUCCESSFUL'::character varying, 'EXPIRED'::character varying, 'CANCELED'::character varying, 'CHARGEBACK'::character varying])::text[])`),
]);

export const websiteSubscriptions = pgTable("website_subscriptions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	type: varchar({ length: 50 }).notNull(),
	price: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	chatbotGiven: integer("chatbot_given").notNull(),
	pagesUpto: integer("pages_upto").notNull(),
	teamMemberAccess: integer("team_member_access").notNull(),
	apiAccess: boolean("api_access").default(false).notNull(),
	autoSyncData: boolean("auto_sync_data").default(false).notNull(),
	autoSyncDataOccurrence: varchar("auto_sync_data_occurrence", { length: 20 }),
	webhookSupport: boolean("webhook_support").default(false).notNull(),
	platformIntegrationAllowed: text("platform_integration_allowed").array(),
	customPlatformIntegration: boolean("custom_platform_integration").default(false).notNull(),
	userMessageRateLimit: integer("user_message_rate_limit").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	paddlePriceId: text("paddle_price_id"),
	rateLimitId: uuid("rate_limit_id").notNull(),
	billingInterval: varchar("billing_interval", { length: 20 }).default('monthly').notNull(),
	trialPeriodDays: integer("trial_period_days").default(0),
	trialPages: integer("trial_pages").default(0),
	trialMessages: integer("trial_messages").default(0),
	trialChatbots: integer("trial_chatbots").default(0),
}, (table) => [
	foreignKey({
			columns: [table.rateLimitId],
			foreignColumns: [rateLimitRules.id],
			name: "fk_rate_limit"
		}).onDelete("cascade"),
	unique("website_subscriptions_paddle_price_id_key").on(table.paddlePriceId),
	check("chk_auto_sync_occurrence", sql`(auto_sync_data = false) OR ((auto_sync_data_occurrence)::text = ANY (ARRAY[('monthly'::character varying)::text, ('weekly'::character varying)::text, ('daily'::character varying)::text]))`),
	check("website_subscriptions_billing_interval_check", sql`(billing_interval)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[])`),
]);

export const ingestionFirecrawlBatchJobs = pgTable("ingestion_firecrawl_batch_jobs", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	userId: uuid("user_id").notNull(),
	jobId: text("job_id").notNull(),
	jobType: varchar("job_type", { length: 20 }).notNull(),
	status: varchar({ length: 20 }).notNull(),
	totalUrls: integer("total_urls").default(0).notNull(),
	processedUrls: integer("processed_urls").default(0).notNull(),
	successfulUrls: integer("successful_urls").default(0).notNull(),
	failedUrls: integer("failed_urls").default(0).notNull(),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_ingestion_firecrawl_batch_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_ingestion_firecrawl_batch_user"
		}).onDelete("cascade"),
]);

export const applicationErrors = pgTable("application_errors", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	errorType: varchar("error_type", { length: 50 }).notNull(),
	severity: varchar({ length: 20 }).notNull(),
	endpoint: varchar({ length: 255 }),
	method: varchar({ length: 10 }),
	requestIp: inet("request_ip"),
	userAgent: text("user_agent"),
	userId: uuid("user_id"),
	chatbotId: uuid("chatbot_id"),
	errorCode: varchar("error_code", { length: 50 }),
	errorMessage: text("error_message").notNull(),
	errorStack: text("error_stack"),
	requestBody: jsonb("request_body"),
	requestParams: jsonb("request_params"),
	requestQuery: jsonb("request_query"),
	metadata: jsonb(),
	resolved: boolean().default(false).notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	resolvedBy: uuid("resolved_by"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "fk_app_error_user"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_app_error_chatbot"
		}).onDelete("set null"),
]);

export const chatbotWidgetConfig = pgTable("chatbot_widget_config", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	allowedDomains: text("allowed_domains").array(),
	widgetEnabled: boolean("widget_enabled").default(true).notNull(),
	widgetVersion: varchar("widget_version", { length: 10 }).default('v1'),
	logConversations: boolean("log_conversations").default(true).notNull(),
	enableAnalytics: boolean("enable_analytics").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_widget_config_chatbot"
		}).onDelete("cascade"),
	unique("chatbot_widget_config_chatbot_id_key").on(table.chatbotId),
]);

export const chatbotWidgetSessions = pgTable("chatbot_widget_sessions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	sessionId: varchar("session_id", { length: 64 }).notNull(),
	originDomain: text("origin_domain"),
	userAgent: text("user_agent"),
	ipAddress: inet("ip_address"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	lastActivityAt: timestamp("last_activity_at", { withTimezone: true, mode: 'string' }),
	messagesCount: integer("messages_count").default(0),
	metadata: jsonb(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_widget_session_chatbot"
		}).onDelete("cascade"),
]);

export const chatbotWidgetInteractions = pgTable("chatbot_widget_interactions", {
	id: uuid().default(sql`uuid_generate_v4()`).primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	sessionId: uuid("session_id"),
	interactionType: varchar("interaction_type", { length: 30 }).notNull(),
	queryText: text("query_text"),
	responseText: text("response_text"),
	llmModelUsed: varchar("llm_model_used", { length: 50 }),
	responseTimeMs: integer("response_time_ms"),
	tokensUsed: integer("tokens_used"),
	errorOccurred: boolean("error_occurred").default(false),
	errorMessage: text("error_message"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_widget_interaction_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [chatbotWidgetSessions.id],
			name: "fk_widget_interaction_session"
		}).onDelete("set null"),
]);

export const ingestionErrors = pgTable("ingestion_errors", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	chatbotId: uuid("chatbot_id").notNull(),
	fileId: uuid("file_id"),
	chunkId: uuid("chunk_id"),
	step: varchar({ length: 50 }).notNull(),
	errorMessage: text("error_message").notNull(),
	retryCount: integer("retry_count").default(0).notNull(),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
	metadata: jsonb().default({}),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.chatbotId],
			foreignColumns: [userChatbots.id],
			name: "fk_ingestion_error_chatbot"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fileId],
			foreignColumns: [ingestionFiles.id],
			name: "fk_ingestion_error_file"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.chunkId],
			foreignColumns: [ingestionChunks.id],
			name: "fk_ingestion_error_chunk"
		}).onDelete("cascade"),
]);
