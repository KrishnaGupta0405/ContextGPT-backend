import { Router } from "express";
import {
  getAllChatbots,
  getChatbotById,
  createChatbot,
  updateChatbot,
  deleteChatbot,
  getAppearanceSettings,
  createAppearanceSettings,
  updateAppearanceSettings,
  getBehaviorSettings,
  createBehaviorSettings,
  updateBehaviorSettings,
  getGeneralSettings,
  createGeneralSettings,
  updateGeneralSettings,
  getConversationStarters,
  createConversationStarter,
  updateConversationStarter,
  deleteConversationStarter,
  getCustomPrompts,
  createCustomPrompt,
  updateCustomPrompt,
  deleteCustomPrompt,
  getFollowUpPrompts,
  createFollowUpPrompt,
  updateFollowUpPrompt,
  deleteFollowUpPrompt,
  getInstructionSettings,
  createInstructionSettings,
  updateInstructionSettings,
  getPersonas,
  createPersona,
  updatePersona,
  deletePersona,
  getLocalizationTexts,
  getLocalizationTextByLocale,
  upsertLocalizationText,
  deleteLocalizationText,
  getLeadSettings,
  createLeadSettings,
  updateLeadSettings,
  getHumanSupportSettings,
  createHumanSupportSettings,
  updateHumanSupportSettings,
} from "../controllers/chatbot.controller.js";

const router = Router();

// ============================================
// USER_CHATBOTS Routes
// ============================================
router.get("/account/:accountId", getAllChatbots);
router.get("/account/:accountId/chatbot/:chatbotId", getChatbotById);
router.post("/account/:accountId", createChatbot);
router.patch("/account/:accountId/chatbot/:chatbotId", updateChatbot);
router.delete("/account/:accountId/chatbot/:chatbotId", deleteChatbot);

// ============================================
// APPEARANCE_UI Routes (1:1)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/appearance",
  getAppearanceSettings
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/appearance",
  createAppearanceSettings
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/appearance",
  updateAppearanceSettings
);

// ============================================
// BEHAVIOR Routes (1:1)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/behavior",
  getBehaviorSettings
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/behavior",
  createBehaviorSettings
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/behavior",
  updateBehaviorSettings
);

// ============================================
// GENERAL_SETTINGS Routes (1:1)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/general",
  getGeneralSettings
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/general",
  createGeneralSettings
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/general",
  updateGeneralSettings
);

// ============================================
// CONVERSATION_STARTERS Routes (1:N)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/conversation-starters",
  getConversationStarters
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/conversation-starters",
  createConversationStarter
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/conversation-starters/:id",
  updateConversationStarter
);
router.delete(
  "/account/:accountId/chatbot/:chatbotId/conversation-starters/:id",
  deleteConversationStarter
);

// ============================================
// CUSTOM_PROMPTS Routes (1:N)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/custom-prompts",
  getCustomPrompts
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/custom-prompts",
  createCustomPrompt
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/custom-prompts/:id",
  updateCustomPrompt
);
router.delete(
  "/account/:accountId/chatbot/:chatbotId/custom-prompts/:id",
  deleteCustomPrompt
);

// ============================================
// FOLLOW_UP_PROMPTS Routes (1:N)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/follow-up-prompts",
  getFollowUpPrompts
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/follow-up-prompts",
  createFollowUpPrompt
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/follow-up-prompts/:id",
  updateFollowUpPrompt
);
router.delete(
  "/account/:accountId/chatbot/:chatbotId/follow-up-prompts/:id",
  deleteFollowUpPrompt
);

// ============================================
// INSTRUCTION_SETTINGS Routes (1:1)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/instruction",
  getInstructionSettings
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/instruction",
  createInstructionSettings
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/instruction",
  updateInstructionSettings
);

// ============================================
// PERSONAS Routes (1:N)
// ============================================
router.get("/account/:accountId/chatbot/:chatbotId/personas", getPersonas);
router.post("/account/:accountId/chatbot/:chatbotId/personas", createPersona);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/personas/:id",
  updatePersona
);
router.delete(
  "/account/:accountId/chatbot/:chatbotId/personas/:id",
  deletePersona
);

// ============================================
// LOCALIZATION_TEXTS Routes (1:N)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/localization",
  getLocalizationTexts
);
router.get(
  "/account/:accountId/chatbot/:chatbotId/localization/:localeCode",
  getLocalizationTextByLocale
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/localization/:localeCode",
  upsertLocalizationText
);
router.delete(
  "/account/:accountId/chatbot/:chatbotId/localization/:localeCode",
  deleteLocalizationText
);

// ============================================
// LEAD_SETTINGS Routes (1:1)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/lead-settings",
  getLeadSettings
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/lead-settings",
  createLeadSettings
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/lead-settings",
  updateLeadSettings
);

// ============================================
// HUMAN_SUPPORT_SETTINGS Routes (1:1)
// ============================================
router.get(
  "/account/:accountId/chatbot/:chatbotId/human-support-settings",
  getHumanSupportSettings
);
router.post(
  "/account/:accountId/chatbot/:chatbotId/human-support-settings",
  createHumanSupportSettings
);
router.patch(
  "/account/:accountId/chatbot/:chatbotId/human-support-settings",
  updateHumanSupportSettings
);

export default router;
