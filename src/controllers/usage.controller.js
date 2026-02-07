import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, sql, and, desc, sum, count } from "drizzle-orm";

// Import schema tables from drizzle
import {
  usersUsageTracking,
  usersLlmUsageEvents,
  usersSubscriptions,
  websiteLlmModels,
  usersApiKeys,
} from "../../drizzle/schema.ts";

/**
 * GET /usage
 * Get overall usage statistics for the authenticated user
 * Returns current billing period usage with subscription details
 */
export const getUsage = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get the latest usage tracking record for the user with subscription details
  const [usageData] = await db
    .select({
      // Usage tracking fields
      id: usersUsageTracking.id,
      userId: usersUsageTracking.userId,
      subscriptionId: usersUsageTracking.subscriptionId,
      periodStart: usersUsageTracking.periodStart,
      periodEnd: usersUsageTracking.periodEnd,
      chatbotsCreated: usersUsageTracking.chatbotsCreated,
      messagesSent: usersUsageTracking.messagesSent,
      messagesReceived: usersUsageTracking.messagesReceived,
      totalTokens: usersUsageTracking.totalTokens,
      pagesIndexed: usersUsageTracking.pagesIndexed,
      teamMembersAdded: usersUsageTracking.teamMembersAdded,
      limitChatbots: usersUsageTracking.limitChatbots,
      limitMessages: usersUsageTracking.limitMessages,
      limitPages: usersUsageTracking.limitPages,
      createdAt: usersUsageTracking.createdAt,
      updatedAt: usersUsageTracking.updatedAt,
      // Subscription status
      subscriptionStatus: usersSubscriptions.status,
    })
    .from(usersUsageTracking)
    .innerJoin(
      usersSubscriptions,
      eq(usersUsageTracking.subscriptionId, usersSubscriptions.id)
    )
    .where(eq(usersUsageTracking.userId, userId))
    .orderBy(desc(usersUsageTracking.periodStart))
    .limit(1);

  if (!usageData) {
    throw new ApiError(404, "No usage data found for this user");
  }

  // Calculate usage percentages
  const usagePercentages = {
    chatbots:
      usageData.limitChatbots > 0
        ? Math.round(
            (usageData.chatbotsCreated / usageData.limitChatbots) * 100
          )
        : 0,
    messages:
      usageData.limitMessages > 0
        ? Math.round((usageData.messagesSent / usageData.limitMessages) * 100)
        : 0,
    pages:
      usageData.limitPages > 0
        ? Math.round((usageData.pagesIndexed / usageData.limitPages) * 100)
        : 0,
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        usage: usageData,
        usagePercentages,
      },
      "Usage data fetched successfully"
    )
  );
});

/**
 * GET /usage/models
 * Get LLM model usage breakdown for the authenticated user
 * Aggregates usage events by model with cost and token statistics
 */
export const getModelsUsage = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get aggregated LLM usage by model
  const modelUsageRecords = await db
    .select({
      modelId: usersLlmUsageEvents.llmModelId,
      modelName: websiteLlmModels.title,
      provider: websiteLlmModels.provider,
      totalEvents: count(usersLlmUsageEvents.id),
      totalInputTokens: sum(usersLlmUsageEvents.inputTokens),
      totalOutputTokens: sum(usersLlmUsageEvents.outputTokens),
      totalTokens: sum(usersLlmUsageEvents.totalTokens),
      totalCost: sum(usersLlmUsageEvents.cost),
    })
    .from(usersLlmUsageEvents)
    .innerJoin(
      websiteLlmModels,
      eq(usersLlmUsageEvents.llmModelId, websiteLlmModels.id)
    )
    .where(eq(usersLlmUsageEvents.userId, userId))
    .groupBy(
      usersLlmUsageEvents.llmModelId,
      websiteLlmModels.title,
      websiteLlmModels.provider
    )
    .orderBy(desc(sum(usersLlmUsageEvents.totalTokens)));

  if (!modelUsageRecords || modelUsageRecords.length === 0) {
    throw new ApiError(404, "No LLM model usage data found for this user");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        models: modelUsageRecords,
        totalModels: modelUsageRecords.length,
      },
      "LLM model usage data fetched successfully"
    )
  );
});

/**
 * GET /usage/period/:startDate
 * Get usage statistics for a specific billing period
 * @param {string} startDate - Billing period start date in ISO format (YYYY-MM-DD or full ISO timestamp)
 */
export const getUsageByPeriod = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { startDate } = req.params;

  // Validate startDate parameter
  if (!startDate) {
    throw new ApiError(400, "Start date parameter is required");
  }

  // Parse and validate the date
  const parsedDate = new Date(startDate);
  if (isNaN(parsedDate.getTime())) {
    throw new ApiError(
      400,
      "Invalid date format. Use ISO format (YYYY-MM-DD or full ISO timestamp)"
    );
  }

  // Get usage data for the specific billing period
  const [usageData] = await db
    .select({
      // Usage tracking fields
      id: usersUsageTracking.id,
      userId: usersUsageTracking.userId,
      subscriptionId: usersUsageTracking.subscriptionId,
      periodStart: usersUsageTracking.periodStart,
      periodEnd: usersUsageTracking.periodEnd,
      chatbotsCreated: usersUsageTracking.chatbotsCreated,
      messagesSent: usersUsageTracking.messagesSent,
      messagesReceived: usersUsageTracking.messagesReceived,
      totalTokens: usersUsageTracking.totalTokens,
      pagesIndexed: usersUsageTracking.pagesIndexed,
      teamMembersAdded: usersUsageTracking.teamMembersAdded,
      limitChatbots: usersUsageTracking.limitChatbots,
      limitMessages: usersUsageTracking.limitMessages,
      limitPages: usersUsageTracking.limitPages,
      createdAt: usersUsageTracking.createdAt,
      updatedAt: usersUsageTracking.updatedAt,
      // Subscription status
      subscriptionStatus: usersSubscriptions.status,
    })
    .from(usersUsageTracking)
    .innerJoin(
      usersSubscriptions,
      eq(usersUsageTracking.subscriptionId, usersSubscriptions.id)
    )
    .where(
      and(
        eq(usersUsageTracking.userId, userId),
        eq(usersUsageTracking.periodStart, parsedDate.toISOString())
      )
    )
    .limit(1);

  if (!usageData) {
    throw new ApiError(
      404,
      `No usage data found for billing period starting on ${startDate}`
    );
  }

  // Get LLM usage events for this period
  const llmUsageForPeriod = await db
    .select({
      modelId: usersLlmUsageEvents.llmModelId,
      modelName: websiteLlmModels.title,
      provider: websiteLlmModels.provider,
      totalEvents: count(usersLlmUsageEvents.id),
      totalInputTokens: sum(usersLlmUsageEvents.inputTokens),
      totalOutputTokens: sum(usersLlmUsageEvents.outputTokens),
      totalTokens: sum(usersLlmUsageEvents.totalTokens),
      totalCost: sum(usersLlmUsageEvents.cost),
    })
    .from(usersLlmUsageEvents)
    .innerJoin(
      websiteLlmModels,
      eq(usersLlmUsageEvents.llmModelId, websiteLlmModels.id)
    )
    .where(
      and(
        eq(usersLlmUsageEvents.userId, userId),
        sql`${usersLlmUsageEvents.createdAt} >= ${parsedDate.toISOString()}`,
        sql`${usersLlmUsageEvents.createdAt} < ${usageData.periodEnd}`
      )
    )
    .groupBy(
      usersLlmUsageEvents.llmModelId,
      websiteLlmModels.title,
      websiteLlmModels.provider
    );

  // Calculate usage percentages
  const usagePercentages = {
    chatbots:
      usageData.limitChatbots > 0
        ? Math.round(
            (usageData.chatbotsCreated / usageData.limitChatbots) * 100
          )
        : 0,
    messages:
      usageData.limitMessages > 0
        ? Math.round((usageData.messagesSent / usageData.limitMessages) * 100)
        : 0,
    pages:
      usageData.limitPages > 0
        ? Math.round((usageData.pagesIndexed / usageData.limitPages) * 100)
        : 0,
  };

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        usage: usageData,
        usagePercentages,
        llmUsageByModel: llmUsageForPeriod,
      },
      `Usage data for period starting ${startDate} fetched successfully`
    )
  );
});

/**
 * POST /api-keys/generate
 * Generate a new API key for the authenticated user
 * Optionally hashes the key for extra security
 */
export const generateApiKey = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const crypto = await import("crypto");

  // Generate a random API key with prefix
  const randomKey = crypto.randomBytes(32).toString("hex");
  const apiKey = `sk_${randomKey}`;

  // Optional: Hash the key for storage (uncomment if you want extra security)
  // const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
  // Note: If you hash the key, you'll need to hash incoming keys for comparison
  // For now, we'll store the key as-is for simplicity

  // Check if user already has an active API key
  const [existingKey] = await db
    .select()
    .from(usersApiKeys)
    .where(
      and(eq(usersApiKeys.userId, userId), eq(usersApiKeys.isActive, true))
    )
    .limit(1);

  if (existingKey) {
    throw new ApiError(
      400,
      "You already have an active API key. Please revoke it before generating a new one."
    );
  }

  // Insert the new API key
  const [newKey] = await db
    .insert(usersApiKeys)
    .values({
      userId: userId,
      apiKey: apiKey, // Store the plain key (or hashedKey if hashing)
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        id: newKey.id,
        apiKey: apiKey, // Return the plain key ONLY on creation (user must save it)
        createdAt: newKey.createdAt,
        expiresAt: newKey.expiresAt,
      },
      "API key generated successfully. Please save this key securely as it won't be shown again."
    )
  );
});

/**
 * GET /api-keys
 * List all API keys for the authenticated user
 * Shows masked keys (e.g., sk_...4a2b) and last used date
 */
export const listApiKeys = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Fetch all API keys for the user
  const apiKeys = await db
    .select({
      id: usersApiKeys.id,
      apiKey: usersApiKeys.apiKey,
      lastUsedAt: usersApiKeys.lastUsedAt,
      isActive: usersApiKeys.isActive,
      createdAt: usersApiKeys.createdAt,
      expiresAt: usersApiKeys.expiresAt,
    })
    .from(usersApiKeys)
    .where(eq(usersApiKeys.userId, userId))
    .orderBy(desc(usersApiKeys.createdAt));

  // Mask the API keys (show only first 3 and last 4 characters)
  const maskedKeys = apiKeys.map((key) => {
    const masked =
      key.apiKey.substring(0, 3) +
      "..." +
      key.apiKey.substring(key.apiKey.length - 4);

    return {
      id: key.id,
      apiKey: masked,
      lastUsedAt: key.lastUsedAt,
      isActive: key.isActive,
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
    };
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        apiKeys: maskedKeys,
        totalKeys: maskedKeys.length,
      },
      "API keys fetched successfully"
    )
  );
});

/**
 * DELETE /api-keys/:keyId/revoke
 * Revoke (deactivate) an API key
 * Sets is_active = FALSE
 */
export const revokeApiKey = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { keyId } = req.params;

  if (!keyId) {
    throw new ApiError(400, "API key ID is required");
  }

  // Verify the key belongs to the user
  const [existingKey] = await db
    .select()
    .from(usersApiKeys)
    .where(and(eq(usersApiKeys.id, keyId), eq(usersApiKeys.userId, userId)))
    .limit(1);

  if (!existingKey) {
    throw new ApiError(404, "API key not found or does not belong to you");
  }

  if (!existingKey.isActive) {
    throw new ApiError(400, "API key is already revoked");
  }

  // Update the key to set is_active = FALSE
  const [revokedKey] = await db
    .update(usersApiKeys)
    .set({
      isActive: false,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(usersApiKeys.id, keyId))
    .returning();

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        id: revokedKey.id,
        isActive: revokedKey.isActive,
        updatedAt: revokedKey.updatedAt,
      },
      "API key revoked successfully"
    )
  );
});

/**
 * GET /api-keys/logs
 * Fetch API request logs for the authenticated user
 * Shows API traffic from users_api_request_logs table
 * Supports pagination via query params: ?limit=50&offset=0
 */
export const getApiLogs = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 50, offset = 0 } = req.query;

  // Note: The users_api_request_logs table needs to be added to the schema
  // For now, this is a placeholder implementation
  // Once the table is added to drizzle/schema.ts, uncomment the code below

  // Fetch API request logs for the user
  const logs = await db
    .select({
      id: usersApiRequestLogs.id,
      apiKeyId: usersApiRequestLogs.apiKeyId,
      endpoint: usersApiRequestLogs.endpoint,
      method: usersApiRequestLogs.method,
      statusCode: usersApiRequestLogs.statusCode,
      requestIp: usersApiRequestLogs.requestIp,
      userAgent: usersApiRequestLogs.userAgent,
      requestTimestamp: usersApiRequestLogs.requestTimestamp,
      responseTimestamp: usersApiRequestLogs.responseTimestamp,
      durationMs: usersApiRequestLogs.durationMs,
      tokensUsed: usersApiRequestLogs.tokensUsed,
      rateLimited: usersApiRequestLogs.rateLimited,
      error: usersApiRequestLogs.error,
      errorMessage: usersApiRequestLogs.errorMessage,
    })
    .from(usersApiRequestLogs)
    .where(eq(usersApiRequestLogs.userId, userId))
    .orderBy(desc(usersApiRequestLogs.requestTimestamp))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  // Get total count for pagination
  const [{ count }] = await db
    .select({ count: count(usersApiRequestLogs.id) })
    .from(usersApiRequestLogs)
    .where(eq(usersApiRequestLogs.userId, userId));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        logs,
        pagination: {
          total: count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + logs.length < count,
        },
      },
      "API logs fetched successfully"
    )
  );
});

// export {
//   getUsage,
//   getModelsUsage,
//   getUsageByPeriod,
//   generateApiKey,
//   listApiKeys,
//   revokeApiKey,
// };
