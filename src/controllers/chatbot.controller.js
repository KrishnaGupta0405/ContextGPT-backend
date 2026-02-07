import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, desc, sql, and } from "drizzle-orm";

import {
  userChatbots,
  userChatbotAppearanceUi,
  userChatbotBehavior,
  userChatbotSettingsGeneral,
  userChatbotConversationStarters,
  userChatbotCustomPrompts,
  userChatbotFollowUpPrompts,
  userChatbotSettingsInstruction,
  userChatbotPersonas,
  userChatbotSettingsLocalizationTexts,
  userChatbotLeadsSettings,
  userChatbotHumanSupportSettings,
  accountMembers,
} from "../../drizzle/schema.ts";

import { canPerformAction } from "../utils/permissionUtils.js";
// Helper functions

// belongs to account_member list?
export const belongsToAccountMemberList = async (account_id, user_id) => {
  const [accountMember] = await db
    .select()
    .from(accountMembers)
    .where(
      and(
        eq(accountMembers.accountId, account_id),
        eq(accountMembers.userId, user_id)
      )
    )
    .limit(1);

  if (!accountMember) {
    throw new ApiError(403, "User does not have access to this account");
  }

  if (!accountMember.role) {
    throw new ApiError(403, "No role assigned — contact support");
  }

  if (!canPerformAction(accountMember.role, "EDIT_CHATBOT_SETTINGS")) {
    throw new ApiError(
      403,
      "User does not have permission to perform this action"
    );
  }
  return accountMember;
};
// Has permission ?

/**
 * ==============================================
 * USER_CHATBOTS - Main Chatbot CRUD
 * ==============================================
 */

// GET all chatbots for an account
const getAllChatbots = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const { userId } = req.user;

  if (!accountId) {
    throw new ApiError(400, "Account ID is required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const chatbots = await db
    .select()
    .from(userChatbots)
    .where(eq(userChatbots.accountId, accountId))
    .orderBy(desc(userChatbots.createdAt));

  res.status(200).json(
    new ApiResponse(200, {
      data: chatbots,
      count: chatbots.length,
    })
  );
});

// GET single chatbot by ID
const getChatbotById = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [chatbot] = await db
    .select()
    .from(userChatbots)
    .where(
      and(eq(userChatbots.id, chatbotId), eq(userChatbots.accountId, accountId))
    )
    .limit(1);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  res.status(200).json(new ApiResponse(200, chatbot));
});

// POST create new chatbot
const createChatbot = asyncHandler(async (req, res) => {
  const { accountId } = req.params;
  const { createdById, name } = req.body;
  const { userId } = req.user;

  if (!accountId) {
    throw new ApiError(400, "Account ID is required");
  }

  if (!name || !createdById) {
    throw new ApiError(400, "Name and createdById are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check for unique chatbot name within the account
  const [existingChatbot] = await db
    .select()
    .from(userChatbots)
    .where(
      and(eq(userChatbots.accountId, accountId), eq(userChatbots.name, name))
    )
    .limit(1);

  if (existingChatbot) {
    throw new ApiError(
      409,
      "A chatbot with this name already exists in this account"
    );
  }

  // Create a new chatbot
  const chatbotId = crypto.randomUUID();
  const vectorNamespace = `bot_${chatbotId}`;
  const result = await db
    .insert(userChatbots)
    .values({
      id: chatbotId,
      accountId,
      createdById,
      name,
      vectorNamespace, // ← Add this line
      vectorIndexVersion: 1, // ← Optional: explicitly set to 1
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create chatbot");
  }

  res
    .status(201)
    .json(new ApiResponse(201, result[0], "Chatbot created successfully"));
});

// PATCH update chatbot
const updateChatbot = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { name } = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check for unique chatbot name within the account if name is being updated
  if (name) {
    const [existingChatbot] = await db
      .select()
      .from(userChatbots)
      .where(
        and(
          eq(userChatbots.accountId, accountId),
          eq(userChatbots.name, name),
          sql`${userChatbots.id} != ${chatbotId}`
        )
      )
      .limit(1);

    if (existingChatbot) {
      throw new ApiError(
        409,
        "A chatbot with this name already exists in this account"
      );
    }
  }

  let updates = req.body;

  // Remove fields that shouldn't be updated
  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbots)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(
      and(eq(userChatbots.id, chatbotId), eq(userChatbots.accountId, accountId))
    )
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Chatbot not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, result[0], "Chatbot updated successfully"));
});

// DELETE chatbot
const deleteChatbot = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const result = await db
    .delete(userChatbots)
    .where(
      and(eq(userChatbots.id, chatbotId), eq(userChatbots.accountId, accountId))
    )
    .returning({ id: userChatbots.id });

  if (!result || result.length === 0) {
    throw new ApiError(404, "Chatbot not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Chatbot deleted successfully"));
});

/**
 * ==============================================
 * USER_CHATBOT_APPEARANCE_UI - 1:1 Settings
 * ==============================================
 */

// GET appearance settings
const getAppearanceSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [settings] = await db
    .select()
    .from(userChatbotAppearanceUi)
    .where(eq(userChatbotAppearanceUi.chatbotId, chatbotId))
    .limit(1);

  if (!settings) {
    throw new ApiError(404, "Appearance settings not found");
  }

  res.status(200).json(new ApiResponse(200, settings));
});

// POST create appearance settings
const createAppearanceSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const settings = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check if settings already exist for this chatbot (1:1 relationship)
  const [existingSettings] = await db
    .select()
    .from(userChatbotAppearanceUi)
    .where(eq(userChatbotAppearanceUi.chatbotId, chatbotId))
    .limit(1);

  if (existingSettings) {
    throw new ApiError(
      409,
      "Appearance settings already exist for this chatbot. Use update instead."
    );
  }

  const result = await db
    .insert(userChatbotAppearanceUi)
    .values({ chatbotId, ...settings })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create appearance settings");
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        result[0],
        "Appearance settings created successfully"
      )
    );
});

// PATCH update appearance settings
const updateAppearanceSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotAppearanceUi)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotAppearanceUi.chatbotId, chatbotId))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Appearance settings not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result[0],
        "Appearance settings updated successfully"
      )
    );
});

/**
 * ==============================================
 * USER_CHATBOT_BEHAVIOR - 1:1 Settings
 * ==============================================
 */

// GET behavior settings
const getBehaviorSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [settings] = await db
    .select()
    .from(userChatbotBehavior)
    .where(eq(userChatbotBehavior.chatbotId, chatbotId))
    .limit(1);

  if (!settings) {
    throw new ApiError(404, "Behavior settings not found");
  }

  res.status(200).json(new ApiResponse(200, settings));
});

// POST create behavior settings
const createBehaviorSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const settings = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check if settings already exist for this chatbot (1:1 relationship)
  const [existingSettings] = await db
    .select()
    .from(userChatbotBehavior)
    .where(eq(userChatbotBehavior.chatbotId, chatbotId))
    .limit(1);

  if (existingSettings) {
    throw new ApiError(
      409,
      "Behavior settings already exist for this chatbot. Use update instead."
    );
  }

  const result = await db
    .insert(userChatbotBehavior)
    .values({ chatbotId, ...settings })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create behavior settings");
  }

  res
    .status(201)
    .json(
      new ApiResponse(201, result[0], "Behavior settings created successfully")
    );
});

// PATCH update behavior settings
const updateBehaviorSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotBehavior)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotBehavior.chatbotId, chatbotId))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Behavior settings not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, result[0], "Behavior settings updated successfully")
    );
});

/**
 * ==============================================
 * USER_CHATBOT_SETTINGS_GENERAL - 1:1 Settings
 * ==============================================
 */

// GET general settings
const getGeneralSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [settings] = await db
    .select()
    .from(userChatbotSettingsGeneral)
    .where(eq(userChatbotSettingsGeneral.chatbotId, chatbotId))
    .limit(1);

  if (!settings) {
    throw new ApiError(404, "General settings not found");
  }

  res.status(200).json(new ApiResponse(200, settings));
});

// POST create general settings
const createGeneralSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const settings = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check if settings already exist for this chatbot (1:1 relationship)
  const [existingSettings] = await db
    .select()
    .from(userChatbotSettingsGeneral)
    .where(eq(userChatbotSettingsGeneral.chatbotId, chatbotId))
    .limit(1);

  if (existingSettings) {
    throw new ApiError(
      409,
      "General settings already exist for this chatbot. Use update instead."
    );
  }

  const result = await db
    .insert(userChatbotSettingsGeneral)
    .values({ chatbotId, ...settings })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create general settings");
  }

  res
    .status(201)
    .json(
      new ApiResponse(201, result[0], "General settings created successfully")
    );
});

// PATCH update general settings
const updateGeneralSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotSettingsGeneral)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotSettingsGeneral.chatbotId, chatbotId))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "General settings not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, result[0], "General settings updated successfully")
    );
});

/**
 * ==============================================
 * USER_CHATBOT_CONVERSATION_STARTERS - 1:N
 * ==============================================
 */

// GET all conversation starters for a chatbot
const getConversationStarters = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const starters = await db
    .select()
    .from(userChatbotConversationStarters)
    .where(eq(userChatbotConversationStarters.chatbotId, chatbotId))
    .orderBy(desc(userChatbotConversationStarters.createdAt));

  res.status(200).json(
    new ApiResponse(200, {
      data: starters,
      count: starters.length,
    })
  );
});

// POST create conversation starter
const createConversationStarter = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { buttonTitle, buttonMessage, linkText, linkSrc } = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const result = await db
    .insert(userChatbotConversationStarters)
    .values({
      chatbotId,
      buttonTitle,
      buttonMessage,
      linkText,
      linkSrc,
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create conversation starter");
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        result[0],
        "Conversation starter created successfully"
      )
    );
});

// PATCH update conversation starter
const updateConversationStarter = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Starter ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotConversationStarters)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotConversationStarters.id, id))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Conversation starter not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result[0],
        "Conversation starter updated successfully"
      )
    );
});

// DELETE conversation starter
const deleteConversationStarter = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Starter ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const result = await db
    .delete(userChatbotConversationStarters)
    .where(eq(userChatbotConversationStarters.id, id))
    .returning({ id: userChatbotConversationStarters.id });

  if (!result || result.length === 0) {
    throw new ApiError(404, "Conversation starter not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, null, "Conversation starter deleted successfully")
    );
});

/**
 * ==============================================
 * USER_CHATBOT_CUSTOM_PROMPTS - 1:N
 * ==============================================
 */

// GET all custom prompts for a chatbot
const getCustomPrompts = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const prompts = await db
    .select()
    .from(userChatbotCustomPrompts)
    .where(eq(userChatbotCustomPrompts.chatbotId, chatbotId))
    .orderBy(desc(userChatbotCustomPrompts.createdAt));

  res.status(200).json(
    new ApiResponse(200, {
      data: prompts,
      count: prompts.length,
    })
  );
});

// POST create custom prompt
const createCustomPrompt = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const {
    title,
    description,
    instructions,
    temperature,
    deletable,
    creativityLevel,
  } = req.body;

  const result = await db
    .insert(userChatbotCustomPrompts)
    .values({
      chatbotId,
      title,
      description,
      instructions,
      temperature,
      deletable,
      creativityLevel,
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create custom prompt");
  }

  res
    .status(201)
    .json(
      new ApiResponse(201, result[0], "Custom prompt created successfully")
    );
});

// PATCH update custom prompt
const updateCustomPrompt = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Prompt ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotCustomPrompts)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotCustomPrompts.id, id))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Custom prompt not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, result[0], "Custom prompt updated successfully")
    );
});

// DELETE custom prompt
const deleteCustomPrompt = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Prompt ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [prompt] = await db
    .select({ deletable: userChatbotCustomPrompts.deletable })
    .from(userChatbotCustomPrompts)
    .where(eq(userChatbotCustomPrompts.id, id))
    .limit(1);

  if (!prompt) {
    throw new ApiError(404, "Custom prompt not found");
  }

  if (!prompt.deletable) {
    throw new ApiError(403, "This custom prompt cannot be deleted");
  }

  const result = await db
    .delete(userChatbotCustomPrompts)
    .where(eq(userChatbotCustomPrompts.id, id))
    .returning({ id: userChatbotCustomPrompts.id });

  if (!result || result.length === 0) {
    throw new ApiError(404, "Custom prompt not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Custom prompt deleted successfully"));
});

/**
 * ==============================================
 * USER_CHATBOT_FOLLOW_UP_PROMPTS - 1:N
 * ==============================================
 */

// GET all follow-up prompts for a chatbot
const getFollowUpPrompts = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const prompts = await db
    .select()
    .from(userChatbotFollowUpPrompts)
    .where(eq(userChatbotFollowUpPrompts.chatbotId, chatbotId))
    .orderBy(desc(userChatbotFollowUpPrompts.createdAt));

  res.status(200).json(
    new ApiResponse(200, {
      data: prompts,
      count: prompts.length,
    })
  );
});

// POST create follow-up prompt
const createFollowUpPrompt = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const { buttonTitle, buttonMessage, linkText, linkSrc } = req.body;

  const result = await db
    .insert(userChatbotFollowUpPrompts)
    .values({
      chatbotId,
      buttonTitle,
      buttonMessage,
      linkText,
      linkSrc,
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create follow-up prompt");
  }

  res
    .status(201)
    .json(
      new ApiResponse(201, result[0], "Follow-up prompt created successfully")
    );
});

// PATCH update follow-up prompt
const updateFollowUpPrompt = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Prompt ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotFollowUpPrompts)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotFollowUpPrompts.id, id))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Follow-up prompt not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, result[0], "Follow-up prompt updated successfully")
    );
});

// DELETE follow-up prompt
const deleteFollowUpPrompt = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Prompt ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const result = await db
    .delete(userChatbotFollowUpPrompts)
    .where(eq(userChatbotFollowUpPrompts.id, id))
    .returning({ id: userChatbotFollowUpPrompts.id });

  if (!result || result.length === 0) {
    throw new ApiError(404, "Follow-up prompt not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Follow-up prompt deleted successfully"));
});

/**
 * ==============================================
 * USER_CHATBOT_SETTINGS_INSTRUCTION - 1:1
 * ==============================================
 */

// GET instruction settings
const getInstructionSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [settings] = await db
    .select()
    .from(userChatbotSettingsInstruction)
    .where(eq(userChatbotSettingsInstruction.chatbotId, chatbotId))
    .limit(1);

  if (!settings) {
    throw new ApiError(404, "Instruction settings not found");
  }

  res.status(200).json(new ApiResponse(200, settings));
});

// POST create instruction settings
const createInstructionSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const { title, instruction, creativityLevel, deletable } = req.body;

  // Check if settings already exist for this chatbot (1:1 relationship)
  const [existingSettings] = await db
    .select()
    .from(userChatbotSettingsInstruction)
    .where(eq(userChatbotSettingsInstruction.chatbotId, chatbotId))
    .limit(1);

  if (existingSettings) {
    throw new ApiError(
      409,
      "Instruction settings already exist for this chatbot. Use update instead."
    );
  }

  const result = await db
    .insert(userChatbotSettingsInstruction)
    .values({
      chatbotId,
      title,
      instruction,
      creativityLevel,
      deletable,
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create instruction settings");
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        result[0],
        "Instruction settings created successfully"
      )
    );
});

// PATCH update instruction settings
const updateInstructionSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotSettingsInstruction)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotSettingsInstruction.chatbotId, chatbotId))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Instruction settings not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result[0],
        "Instruction settings updated successfully"
      )
    );
});

/**
 * ==============================================
 * USER_CHATBOT_PERSONAS - 1:N
 * ==============================================
 */

// GET all personas for a chatbot
const getPersonas = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const personas = await db
    .select()
    .from(userChatbotPersonas)
    .where(eq(userChatbotPersonas.chatbotId, chatbotId))
    .orderBy(desc(userChatbotPersonas.createdAt));

  res.status(200).json(
    new ApiResponse(200, {
      data: personas,
      count: personas.length,
    })
  );
});

// POST create persona
const createPersona = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const { title, description, instructions, creativityLevel, deletable } =
    req.body;

  const result = await db
    .insert(userChatbotPersonas)
    .values({
      chatbotId,
      title,
      description,
      instructions,
      creativityLevel,
      deletable,
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create persona");
  }

  res
    .status(201)
    .json(new ApiResponse(201, result[0], "Persona created successfully"));
});

// PATCH update persona
const updatePersona = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Persona ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotPersonas)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotPersonas.id, id))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Persona not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, result[0], "Persona updated successfully"));
});

// DELETE persona
const deletePersona = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, id } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !id) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Persona ID are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [persona] = await db
    .select({ deletable: userChatbotPersonas.deletable })
    .from(userChatbotPersonas)
    .where(eq(userChatbotPersonas.id, id))
    .limit(1);

  if (!persona) {
    throw new ApiError(404, "Persona not found");
  }

  if (!persona.deletable) {
    throw new ApiError(403, "This persona cannot be deleted (default persona)");
  }

  const result = await db
    .delete(userChatbotPersonas)
    .where(eq(userChatbotPersonas.id, id))
    .returning({ id: userChatbotPersonas.id });

  if (!result || result.length === 0) {
    throw new ApiError(404, "Persona not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Persona deleted successfully"));
});

/**
 * ==============================================
 * USER_CHATBOT_SETTINGS_LOCALIZATION_TEXTS - 1:N
 * ==============================================
 */

// GET all localization texts for a chatbot
const getLocalizationTexts = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const texts = await db
    .select()
    .from(userChatbotSettingsLocalizationTexts)
    .where(eq(userChatbotSettingsLocalizationTexts.chatbotId, chatbotId))
    .orderBy(userChatbotSettingsLocalizationTexts.localeCode);

  res.status(200).json(
    new ApiResponse(200, {
      data: texts,
      count: texts.length,
    })
  );
});

// GET localization text by locale
const getLocalizationTextByLocale = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, localeCode } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !localeCode) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Locale Code are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [text] = await db
    .select()
    .from(userChatbotSettingsLocalizationTexts)
    .where(
      and(
        eq(userChatbotSettingsLocalizationTexts.chatbotId, chatbotId),
        eq(userChatbotSettingsLocalizationTexts.localeCode, localeCode)
      )
    )
    .limit(1);

  if (!text) {
    throw new ApiError(404, "Localization text not found for this locale");
  }

  res.status(200).json(new ApiResponse(200, text));
});

// POST/PATCH upsert localization text (create or update)
const upsertLocalizationText = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, localeCode } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !localeCode) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Locale Code are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.chatbotId;
  delete updates.localeCode;
  delete updates.createdAt;

  const result = await db
    .insert(userChatbotSettingsLocalizationTexts)
    .values({ chatbotId, localeCode, ...updates })
    .onConflictDoUpdate({
      target: [
        userChatbotSettingsLocalizationTexts.chatbotId,
        userChatbotSettingsLocalizationTexts.localeCode,
      ],
      set: { ...updates, updatedAt: sql`now()` },
    })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to save localization text");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, result[0], "Localization text saved successfully")
    );
});

// DELETE localization text
const deleteLocalizationText = asyncHandler(async (req, res) => {
  const { accountId, chatbotId, localeCode } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId || !localeCode) {
    throw new ApiError(
      400,
      "Account ID, Chatbot ID, and Locale Code are required"
    );
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const result = await db
    .delete(userChatbotSettingsLocalizationTexts)
    .where(
      and(
        eq(userChatbotSettingsLocalizationTexts.chatbotId, chatbotId),
        eq(userChatbotSettingsLocalizationTexts.localeCode, localeCode)
      )
    )
    .returning({ id: userChatbotSettingsLocalizationTexts.id });

  if (!result || result.length === 0) {
    throw new ApiError(404, "Localization text not found");
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, "Localization text deleted successfully"));
});

/**
 * ==============================================
 * USER_CHATBOT_LEADS_SETTINGS - 1:1
 * ==============================================
 */

// GET lead settings
const getLeadSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [settings] = await db
    .select()
    .from(userChatbotLeadsSettings)
    .where(eq(userChatbotLeadsSettings.chatbotId, chatbotId))
    .limit(1);

  if (!settings) {
    throw new ApiError(404, "Lead settings not found");
  }

  res.status(200).json(new ApiResponse(200, settings));
});

// POST create lead settings
const createLeadSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const settings = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check if settings already exist for this chatbot (1:1 relationship)
  const [existingSettings] = await db
    .select()
    .from(userChatbotLeadsSettings)
    .where(eq(userChatbotLeadsSettings.chatbotId, chatbotId))
    .limit(1);

  if (existingSettings) {
    throw new ApiError(
      409,
      "Lead settings already exist for this chatbot. Use update instead."
    );
  }

  const result = await db
    .insert(userChatbotLeadsSettings)
    .values({ chatbotId, ...settings })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create lead settings");
  }

  res
    .status(201)
    .json(
      new ApiResponse(201, result[0], "Lead settings created successfully")
    );
});

// PATCH update lead settings
const updateLeadSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotLeadsSettings)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotLeadsSettings.chatbotId, chatbotId))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Lead settings not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, result[0], "Lead settings updated successfully")
    );
});

/**
 * ==============================================
 * USER_CHATBOT_HUMAN_SUPPORT_SETTINGS - 1:1
 * ==============================================
 */

// GET human support settings
const getHumanSupportSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  const [settings] = await db
    .select()
    .from(userChatbotHumanSupportSettings)
    .where(eq(userChatbotHumanSupportSettings.chatbotId, chatbotId))
    .limit(1);

  if (!settings) {
    throw new ApiError(404, "Human support settings not found");
  }

  res.status(200).json(new ApiResponse(200, settings));
});

// POST create human support settings
const createHumanSupportSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const settings = req.body;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  // Check if settings already exist for this chatbot (1:1 relationship)
  const [existingSettings] = await db
    .select()
    .from(userChatbotHumanSupportSettings)
    .where(eq(userChatbotHumanSupportSettings.chatbotId, chatbotId))
    .limit(1);

  if (existingSettings) {
    throw new ApiError(
      409,
      "Human support settings already exist for this chatbot. Use update instead."
    );
  }

  const result = await db
    .insert(userChatbotHumanSupportSettings)
    .values({ chatbotId, ...settings })
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(500, "Failed to create human support settings");
  }

  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        result[0],
        "Human support settings created successfully"
      )
    );
});

// PATCH update human support settings
const updateHumanSupportSettings = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  const existingUser = await belongsToAccountMemberList(accountId, userId);

  let updates = req.body;

  delete updates.id;
  delete updates.accountId;
  delete updates.chatbotId;
  delete updates.createdAt;

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No fields to update");
  }

  const result = await db
    .update(userChatbotHumanSupportSettings)
    .set({ ...updates, updatedAt: sql`now()` })
    .where(eq(userChatbotHumanSupportSettings.chatbotId, chatbotId))
    .returning();

  if (!result || result.length === 0) {
    throw new ApiError(404, "Human support settings not found");
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result[0],
        "Human support settings updated successfully"
      )
    );
});

// Export all controllers
export {
  // User Chatbots
  getAllChatbots,
  getChatbotById,
  createChatbot,
  updateChatbot,
  deleteChatbot,

  // Appearance UI
  getAppearanceSettings,
  createAppearanceSettings,
  updateAppearanceSettings,

  // Behavior
  getBehaviorSettings,
  createBehaviorSettings,
  updateBehaviorSettings,

  // General Settings
  getGeneralSettings,
  createGeneralSettings,
  updateGeneralSettings,

  // Conversation Starters
  getConversationStarters,
  createConversationStarter,
  updateConversationStarter,
  deleteConversationStarter,

  // Custom Prompts
  getCustomPrompts,
  createCustomPrompt,
  updateCustomPrompt,
  deleteCustomPrompt,

  // Follow-up Prompts
  getFollowUpPrompts,
  createFollowUpPrompt,
  updateFollowUpPrompt,
  deleteFollowUpPrompt,

  // Instruction Settings
  getInstructionSettings,
  createInstructionSettings,
  updateInstructionSettings,

  // Personas
  getPersonas,
  createPersona,
  updatePersona,
  deletePersona,

  // Localization
  getLocalizationTexts,
  getLocalizationTextByLocale,
  upsertLocalizationText,
  deleteLocalizationText,

  // Lead Settings
  getLeadSettings,
  createLeadSettings,
  updateLeadSettings,

  // Human Support Settings
  getHumanSupportSettings,
  createHumanSupportSettings,
  updateHumanSupportSettings,
};
