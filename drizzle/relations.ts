import { relations } from "drizzle-orm/relations";
import { ingestionFirecrawlBatchJobs, ingestionFiles, userChatbots, users, ingestionSources, ingestionStatusLogs, ingestionChunks, userChatbotAppearanceUi, userChatbotBehavior, userChatbotConversationStarters, userChatbotFollowUpPrompts, userChatbotHumanSupportSettings, userChatbotIntegrations, userChatbotCustomPrompts, userChatbotLeadsSettings, userChatbotPersonas, userChatbotRetrievalRuns, userChatbotThreads, userChatbotSettingsGeneral, userChatbotSettingsInstruction, userChatbotSettingsLocalizationTexts, userChatbotSystemErrors, userChatbotMessages, websiteLlmModels, usersApiKeys, userChatbotChattingCustomers, accounts, paddleTransactions, websiteSubscriptions, accountInvitations, usersSessions, accountMembers, usersSubscriptions, usersApiRequestLogs, rateLimitRules, usersRateLimitConsumption, usersLlmUsageEvents, usersUsageTracking, websitePromotionReferral, usersPromotionReferrals, applicationErrors, chatbotWidgetConfig, chatbotWidgetSessions, chatbotWidgetInteractions, ingestionErrors } from "./schema";

export const ingestionFilesRelations = relations(ingestionFiles, ({one, many}) => ({
	ingestionFirecrawlBatchJob: one(ingestionFirecrawlBatchJobs, {
		fields: [ingestionFiles.ingestionFirecrawlBatchJobsId],
		references: [ingestionFirecrawlBatchJobs.id]
	}),
	userChatbot: one(userChatbots, {
		fields: [ingestionFiles.chatbotId],
		references: [userChatbots.id]
	}),
	user: one(users, {
		fields: [ingestionFiles.userId],
		references: [users.id]
	}),
	ingestionSources: many(ingestionSources),
	ingestionStatusLogs: many(ingestionStatusLogs),
	userChatbotSystemErrors: many(userChatbotSystemErrors),
	ingestionChunks: many(ingestionChunks),
	ingestionErrors: many(ingestionErrors),
}));

export const ingestionFirecrawlBatchJobsRelations = relations(ingestionFirecrawlBatchJobs, ({one, many}) => ({
	ingestionFiles: many(ingestionFiles),
	userChatbot: one(userChatbots, {
		fields: [ingestionFirecrawlBatchJobs.chatbotId],
		references: [userChatbots.id]
	}),
	user: one(users, {
		fields: [ingestionFirecrawlBatchJobs.userId],
		references: [users.id]
	}),
}));

export const userChatbotsRelations = relations(userChatbots, ({one, many}) => ({
	ingestionFiles: many(ingestionFiles),
	ingestionSources: many(ingestionSources),
	ingestionStatusLogs: many(ingestionStatusLogs),
	userChatbotAppearanceUis: many(userChatbotAppearanceUi),
	userChatbotBehaviors: many(userChatbotBehavior),
	userChatbotConversationStarters: many(userChatbotConversationStarters),
	userChatbotFollowUpPrompts: many(userChatbotFollowUpPrompts),
	userChatbotHumanSupportSettings: many(userChatbotHumanSupportSettings),
	userChatbotIntegrations: many(userChatbotIntegrations),
	userChatbotCustomPrompts: many(userChatbotCustomPrompts),
	userChatbotLeadsSettings: many(userChatbotLeadsSettings),
	userChatbotPersonas: many(userChatbotPersonas),
	userChatbotRetrievalRuns: many(userChatbotRetrievalRuns),
	userChatbotSettingsGenerals: many(userChatbotSettingsGeneral),
	userChatbotSettingsInstructions: many(userChatbotSettingsInstruction),
	userChatbotSettingsLocalizationTexts: many(userChatbotSettingsLocalizationTexts),
	userChatbotSystemErrors: many(userChatbotSystemErrors),
	userChatbotMessages: many(userChatbotMessages),
	userChatbotThreads: many(userChatbotThreads),
	user: one(users, {
		fields: [userChatbots.createdById],
		references: [users.id]
	}),
	account: one(accounts, {
		fields: [userChatbots.accountId],
		references: [accounts.id]
	}),
	usersLlmUsageEvents: many(usersLlmUsageEvents),
	ingestionFirecrawlBatchJobs: many(ingestionFirecrawlBatchJobs),
	applicationErrors: many(applicationErrors),
	chatbotWidgetConfigs: many(chatbotWidgetConfig),
	chatbotWidgetSessions: many(chatbotWidgetSessions),
	chatbotWidgetInteractions: many(chatbotWidgetInteractions),
	ingestionErrors: many(ingestionErrors),
}));

export const usersRelations = relations(users, ({many}) => ({
	ingestionFiles: many(ingestionFiles),
	userChatbotSystemErrors: many(userChatbotSystemErrors),
	usersApiKeys: many(usersApiKeys),
	userChatbots: many(userChatbots),
	paddleTransactions: many(paddleTransactions),
	accounts: many(accounts),
	accountInvitations: many(accountInvitations),
	usersSessions: many(usersSessions),
	accountMembers: many(accountMembers),
	usersSubscriptions: many(usersSubscriptions),
	usersApiRequestLogs: many(usersApiRequestLogs),
	usersLlmUsageEvents: many(usersLlmUsageEvents),
	usersUsageTrackings: many(usersUsageTracking),
	websitePromotionReferrals: many(websitePromotionReferral),
	usersPromotionReferrals_referrerUserId: many(usersPromotionReferrals, {
		relationName: "usersPromotionReferrals_referrerUserId_users_id"
	}),
	usersPromotionReferrals_referredUserId: many(usersPromotionReferrals, {
		relationName: "usersPromotionReferrals_referredUserId_users_id"
	}),
	ingestionFirecrawlBatchJobs: many(ingestionFirecrawlBatchJobs),
	applicationErrors: many(applicationErrors),
}));

export const ingestionSourcesRelations = relations(ingestionSources, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [ingestionSources.chatbotId],
		references: [userChatbots.id]
	}),
	ingestionFile: one(ingestionFiles, {
		fields: [ingestionSources.fileId],
		references: [ingestionFiles.id]
	}),
}));

export const ingestionStatusLogsRelations = relations(ingestionStatusLogs, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [ingestionStatusLogs.chatbotId],
		references: [userChatbots.id]
	}),
	ingestionFile: one(ingestionFiles, {
		fields: [ingestionStatusLogs.fileId],
		references: [ingestionFiles.id]
	}),
	ingestionChunk: one(ingestionChunks, {
		fields: [ingestionStatusLogs.chunkId],
		references: [ingestionChunks.id]
	}),
}));

export const ingestionChunksRelations = relations(ingestionChunks, ({one, many}) => ({
	ingestionStatusLogs: many(ingestionStatusLogs),
	userChatbotSystemErrors: many(userChatbotSystemErrors),
	ingestionFile: one(ingestionFiles, {
		fields: [ingestionChunks.fileId],
		references: [ingestionFiles.id]
	}),
	ingestionErrors: many(ingestionErrors),
}));

export const userChatbotAppearanceUiRelations = relations(userChatbotAppearanceUi, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotAppearanceUi.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotBehaviorRelations = relations(userChatbotBehavior, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotBehavior.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotConversationStartersRelations = relations(userChatbotConversationStarters, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotConversationStarters.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotFollowUpPromptsRelations = relations(userChatbotFollowUpPrompts, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotFollowUpPrompts.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotHumanSupportSettingsRelations = relations(userChatbotHumanSupportSettings, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotHumanSupportSettings.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotIntegrationsRelations = relations(userChatbotIntegrations, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotIntegrations.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotCustomPromptsRelations = relations(userChatbotCustomPrompts, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotCustomPrompts.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotLeadsSettingsRelations = relations(userChatbotLeadsSettings, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotLeadsSettings.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotPersonasRelations = relations(userChatbotPersonas, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotPersonas.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotRetrievalRunsRelations = relations(userChatbotRetrievalRuns, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotRetrievalRuns.chatbotId],
		references: [userChatbots.id]
	}),
	userChatbotThread: one(userChatbotThreads, {
		fields: [userChatbotRetrievalRuns.threadId],
		references: [userChatbotThreads.id]
	}),
}));

export const userChatbotThreadsRelations = relations(userChatbotThreads, ({one, many}) => ({
	userChatbotRetrievalRuns: many(userChatbotRetrievalRuns),
	userChatbotSystemErrors: many(userChatbotSystemErrors),
	userChatbotMessages: many(userChatbotMessages),
	userChatbot: one(userChatbots, {
		fields: [userChatbotThreads.chatbotId],
		references: [userChatbots.id]
	}),
	userChatbotChattingCustomer: one(userChatbotChattingCustomers, {
		fields: [userChatbotThreads.chatUserId],
		references: [userChatbotChattingCustomers.id]
	}),
}));

export const userChatbotSettingsGeneralRelations = relations(userChatbotSettingsGeneral, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotSettingsGeneral.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotSettingsInstructionRelations = relations(userChatbotSettingsInstruction, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotSettingsInstruction.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotSettingsLocalizationTextsRelations = relations(userChatbotSettingsLocalizationTexts, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [userChatbotSettingsLocalizationTexts.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const userChatbotSystemErrorsRelations = relations(userChatbotSystemErrors, ({one}) => ({
	user: one(users, {
		fields: [userChatbotSystemErrors.userId],
		references: [users.id]
	}),
	userChatbot: one(userChatbots, {
		fields: [userChatbotSystemErrors.chatbotId],
		references: [userChatbots.id]
	}),
	userChatbotThread: one(userChatbotThreads, {
		fields: [userChatbotSystemErrors.threadId],
		references: [userChatbotThreads.id]
	}),
	userChatbotMessage: one(userChatbotMessages, {
		fields: [userChatbotSystemErrors.messageId],
		references: [userChatbotMessages.id]
	}),
	ingestionFile: one(ingestionFiles, {
		fields: [userChatbotSystemErrors.fileId],
		references: [ingestionFiles.id]
	}),
	ingestionChunk: one(ingestionChunks, {
		fields: [userChatbotSystemErrors.chunkId],
		references: [ingestionChunks.id]
	}),
}));

export const userChatbotMessagesRelations = relations(userChatbotMessages, ({one, many}) => ({
	userChatbotSystemErrors: many(userChatbotSystemErrors),
	userChatbot: one(userChatbots, {
		fields: [userChatbotMessages.chatbotId],
		references: [userChatbots.id]
	}),
	websiteLlmModel: one(websiteLlmModels, {
		fields: [userChatbotMessages.llmModelId],
		references: [websiteLlmModels.id]
	}),
	userChatbotThread: one(userChatbotThreads, {
		fields: [userChatbotMessages.threadId],
		references: [userChatbotThreads.id]
	}),
	usersLlmUsageEvents: many(usersLlmUsageEvents),
}));

export const websiteLlmModelsRelations = relations(websiteLlmModels, ({one, many}) => ({
	userChatbotMessages: many(userChatbotMessages),
	websiteSubscription: one(websiteSubscriptions, {
		fields: [websiteLlmModels.underThisSubscriptionId],
		references: [websiteSubscriptions.id]
	}),
	usersApiRequestLogs: many(usersApiRequestLogs),
	usersLlmUsageEvents: many(usersLlmUsageEvents),
}));

export const usersApiKeysRelations = relations(usersApiKeys, ({one, many}) => ({
	user: one(users, {
		fields: [usersApiKeys.userId],
		references: [users.id]
	}),
	usersApiRequestLogs: many(usersApiRequestLogs),
}));

export const userChatbotChattingCustomersRelations = relations(userChatbotChattingCustomers, ({many}) => ({
	userChatbotThreads: many(userChatbotThreads),
}));

export const accountsRelations = relations(accounts, ({one, many}) => ({
	userChatbots: many(userChatbots),
	user: one(users, {
		fields: [accounts.ownerId],
		references: [users.id]
	}),
	accountInvitations: many(accountInvitations),
	accountMembers: many(accountMembers),
}));

export const paddleTransactionsRelations = relations(paddleTransactions, ({one}) => ({
	user: one(users, {
		fields: [paddleTransactions.userId],
		references: [users.id]
	}),
}));

export const websiteSubscriptionsRelations = relations(websiteSubscriptions, ({one, many}) => ({
	websiteLlmModels: many(websiteLlmModels),
	usersSubscriptions: many(usersSubscriptions),
	rateLimitRule: one(rateLimitRules, {
		fields: [websiteSubscriptions.rateLimitId],
		references: [rateLimitRules.id]
	}),
}));

export const accountInvitationsRelations = relations(accountInvitations, ({one}) => ({
	account: one(accounts, {
		fields: [accountInvitations.accountId],
		references: [accounts.id]
	}),
	user: one(users, {
		fields: [accountInvitations.invitedById],
		references: [users.id]
	}),
}));

export const usersSessionsRelations = relations(usersSessions, ({one}) => ({
	user: one(users, {
		fields: [usersSessions.userId],
		references: [users.id]
	}),
}));

export const accountMembersRelations = relations(accountMembers, ({one}) => ({
	account: one(accounts, {
		fields: [accountMembers.accountId],
		references: [accounts.id]
	}),
	user: one(users, {
		fields: [accountMembers.userId],
		references: [users.id]
	}),
}));

export const usersSubscriptionsRelations = relations(usersSubscriptions, ({one, many}) => ({
	user: one(users, {
		fields: [usersSubscriptions.userId],
		references: [users.id]
	}),
	websiteSubscription: one(websiteSubscriptions, {
		fields: [usersSubscriptions.subscriptionId],
		references: [websiteSubscriptions.id]
	}),
	usersUsageTrackings: many(usersUsageTracking),
	usersPromotionReferrals: many(usersPromotionReferrals),
}));

export const usersApiRequestLogsRelations = relations(usersApiRequestLogs, ({one}) => ({
	user: one(users, {
		fields: [usersApiRequestLogs.userId],
		references: [users.id]
	}),
	usersApiKey: one(usersApiKeys, {
		fields: [usersApiRequestLogs.apiKeyId],
		references: [usersApiKeys.id]
	}),
	websiteLlmModel: one(websiteLlmModels, {
		fields: [usersApiRequestLogs.llmModelId],
		references: [websiteLlmModels.id]
	}),
}));

export const usersRateLimitConsumptionRelations = relations(usersRateLimitConsumption, ({one}) => ({
	rateLimitRule: one(rateLimitRules, {
		fields: [usersRateLimitConsumption.ruleId],
		references: [rateLimitRules.id]
	}),
}));

export const rateLimitRulesRelations = relations(rateLimitRules, ({many}) => ({
	usersRateLimitConsumptions: many(usersRateLimitConsumption),
	websiteSubscriptions: many(websiteSubscriptions),
}));

export const usersLlmUsageEventsRelations = relations(usersLlmUsageEvents, ({one}) => ({
	user: one(users, {
		fields: [usersLlmUsageEvents.userId],
		references: [users.id]
	}),
	userChatbot: one(userChatbots, {
		fields: [usersLlmUsageEvents.chatbotId],
		references: [userChatbots.id]
	}),
	userChatbotMessage: one(userChatbotMessages, {
		fields: [usersLlmUsageEvents.messageId],
		references: [userChatbotMessages.id]
	}),
	websiteLlmModel: one(websiteLlmModels, {
		fields: [usersLlmUsageEvents.llmModelId],
		references: [websiteLlmModels.id]
	}),
}));

export const usersUsageTrackingRelations = relations(usersUsageTracking, ({one}) => ({
	user: one(users, {
		fields: [usersUsageTracking.userId],
		references: [users.id]
	}),
	usersSubscription: one(usersSubscriptions, {
		fields: [usersUsageTracking.subscriptionId],
		references: [usersSubscriptions.id]
	}),
}));

export const websitePromotionReferralRelations = relations(websitePromotionReferral, ({one, many}) => ({
	user: one(users, {
		fields: [websitePromotionReferral.createdBy],
		references: [users.id]
	}),
	usersPromotionReferrals: many(usersPromotionReferrals),
}));

export const usersPromotionReferralsRelations = relations(usersPromotionReferrals, ({one}) => ({
	user_referrerUserId: one(users, {
		fields: [usersPromotionReferrals.referrerUserId],
		references: [users.id],
		relationName: "usersPromotionReferrals_referrerUserId_users_id"
	}),
	user_referredUserId: one(users, {
		fields: [usersPromotionReferrals.referredUserId],
		references: [users.id],
		relationName: "usersPromotionReferrals_referredUserId_users_id"
	}),
	websitePromotionReferral: one(websitePromotionReferral, {
		fields: [usersPromotionReferrals.promotionId],
		references: [websitePromotionReferral.id]
	}),
	usersSubscription: one(usersSubscriptions, {
		fields: [usersPromotionReferrals.subscriptionId],
		references: [usersSubscriptions.id]
	}),
}));

export const applicationErrorsRelations = relations(applicationErrors, ({one}) => ({
	user: one(users, {
		fields: [applicationErrors.userId],
		references: [users.id]
	}),
	userChatbot: one(userChatbots, {
		fields: [applicationErrors.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const chatbotWidgetConfigRelations = relations(chatbotWidgetConfig, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [chatbotWidgetConfig.chatbotId],
		references: [userChatbots.id]
	}),
}));

export const chatbotWidgetSessionsRelations = relations(chatbotWidgetSessions, ({one, many}) => ({
	userChatbot: one(userChatbots, {
		fields: [chatbotWidgetSessions.chatbotId],
		references: [userChatbots.id]
	}),
	chatbotWidgetInteractions: many(chatbotWidgetInteractions),
}));

export const chatbotWidgetInteractionsRelations = relations(chatbotWidgetInteractions, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [chatbotWidgetInteractions.chatbotId],
		references: [userChatbots.id]
	}),
	chatbotWidgetSession: one(chatbotWidgetSessions, {
		fields: [chatbotWidgetInteractions.sessionId],
		references: [chatbotWidgetSessions.id]
	}),
}));

export const ingestionErrorsRelations = relations(ingestionErrors, ({one}) => ({
	userChatbot: one(userChatbots, {
		fields: [ingestionErrors.chatbotId],
		references: [userChatbots.id]
	}),
	ingestionFile: one(ingestionFiles, {
		fields: [ingestionErrors.fileId],
		references: [ingestionFiles.id]
	}),
	ingestionChunk: one(ingestionChunks, {
		fields: [ingestionErrors.chunkId],
		references: [ingestionChunks.id]
	}),
}));