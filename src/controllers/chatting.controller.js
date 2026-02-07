// http api post https://i1m04cdjgd.execute-api.us-east-1.amazonaws.com/query for query the data
// embedded code -> <script type="text/javascript">window.$sitegpt=[];(function(){d=document;s=d.createElement("script");s.src="https://sitegpt.ai/widget/93ab558e-8c8d-415e-8355-0fe0c1df4bb2.js";s.async=1;d.getElementsByTagName("head")[0].appendChild(s);})();</script>
// ebedded chatbot code -> 93ab558e-8c8d-415e-8355-0fe0c1df4bb2

import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, and, sql, gte } from "drizzle-orm";
import axios from "axios";

import {
  userChatbots,
  accounts,
  usersSubscriptions,
  chatbotWidgetConfig,
  chatbotWidgetSessions,
  chatbotWidgetInteractions,
  rateLimitRules,
  usersRateLimitConsumption,
  usersLlmUsageEvents,
  usersUsageTracking,
  websiteLlmModels,
  userChatbotSettingsGeneral,
} from "../../drizzle/schema.ts";

/**
 * ==============================================
 * CHATBOT QUERY HANDLER
 * ==============================================
 */

// Helper function to check rate limits
async function checkRateLimit(chatbotId, limitType = "messages") {
  // Get rate limit rules for this chatbot
  const [rule] = await db
    .select()
    .from(rateLimitRules)
    .where(
      and(
        eq(rateLimitRules.subjectType, "CHATBOT"),
        eq(rateLimitRules.subjectId, chatbotId),
        eq(rateLimitRules.limitType, limitType),
        eq(rateLimitRules.isEnabled, true)
      )
    )
    .limit(1);

  if (!rule) {
    // No rate limit configured, allow request
    return { allowed: true };
  }

  // Calculate window start and end
  const windowStart = new Date(Date.now() - rule.windowSeconds * 1000);
  const windowEnd = new Date();

  // Get current consumption
  const [consumption] = await db
    .select()
    .from(usersRateLimitConsumption)
    .where(
      and(
        eq(usersRateLimitConsumption.ruleId, rule.id),
        eq(usersRateLimitConsumption.subjectId, chatbotId),
        gte(usersRateLimitConsumption.windowEnd, new Date())
      )
    )
    .limit(1);

  if (consumption && consumption.consumedValue >= rule.maxValue) {
    const retryAfter = Math.ceil(
      (new Date(consumption.windowEnd).getTime() - Date.now()) / 1000
    );
    return {
      allowed: false,
      retryAfter,
      limit: rule.maxValue,
      remaining: 0,
    };
  }

  const currentConsumption = consumption?.consumedValue || 0;

  return {
    allowed: true,
    limit: rule.maxValue,
    remaining: rule.maxValue - currentConsumption,
    ruleId: rule.id,
    windowStart,
    windowEnd,
  };
}

// Helper function to increment rate limit consumption
async function incrementRateLimit(rateLimitInfo, chatbotId) {
  if (!rateLimitInfo.ruleId) return;

  // Check if consumption record exists
  const [existing] = await db
    .select()
    .from(usersRateLimitConsumption)
    .where(
      and(
        eq(usersRateLimitConsumption.ruleId, rateLimitInfo.ruleId),
        eq(usersRateLimitConsumption.subjectId, chatbotId),
        gte(usersRateLimitConsumption.windowEnd, new Date())
      )
    )
    .limit(1);

  if (existing) {
    // Update existing consumption
    await db
      .update(usersRateLimitConsumption)
      .set({
        consumedValue: sql`${usersRateLimitConsumption.consumedValue} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(usersRateLimitConsumption.id, existing.id));
  } else {
    // Create new consumption record
    await db.insert(usersRateLimitConsumption).values({
      ruleId: rateLimitInfo.ruleId,
      subjectId: chatbotId,
      limitType: "messages",
      consumedValue: 1,
      windowStart: rateLimitInfo.windowStart,
      windowEnd: rateLimitInfo.windowEnd,
    });
  }
}

// Helper function to log usage
async function logUsageEvent(
  chatbotId,
  accountId,
  llmModelId,
  inputTokens,
  outputTokens,
  cost,
  messageId = null
) {
  try {
    // Get account owner (user_id)
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) return;

    // Log LLM usage event
    if (messageId) {
      await db.insert(usersLlmUsageEvents).values({
        userId: account.ownerId,
        chatbotId,
        messageId,
        llmModelId,
        inputTokens,
        outputTokens,
        cost,
      });
    }

    // Update usage tracking for current billing period
    const [subscription] = await db
      .select()
      .from(usersSubscriptions)
      .where(
        and(
          eq(usersSubscriptions.userId, account.ownerId),
          eq(usersSubscriptions.status, "active")
        )
      )
      .limit(1);

    if (subscription) {
      // Check if usage tracking exists for current period
      const [tracking] = await db
        .select()
        .from(usersUsageTracking)
        .where(
          and(
            eq(usersUsageTracking.userId, account.ownerId),
            eq(usersUsageTracking.subscriptionId, subscription.id),
            eq(usersUsageTracking.periodStart, subscription.currentPeriodStart)
          )
        )
        .limit(1);

      if (tracking) {
        // Update existing tracking
        await db
          .update(usersUsageTracking)
          .set({
            messagesReceived: sql`${usersUsageTracking.messagesReceived} + 1`,
            totalTokens: sql`${usersUsageTracking.totalTokens} + ${inputTokens + outputTokens}`,
            updatedAt: sql`now()`,
          })
          .where(eq(usersUsageTracking.id, tracking.id));
      } else {
        // Create new tracking record
        await db.insert(usersUsageTracking).values({
          userId: account.ownerId,
          subscriptionId: subscription.id,
          periodStart: subscription.currentPeriodStart,
          periodEnd: subscription.currentPeriodEnd,
          messagesReceived: 1,
          totalTokens: inputTokens + outputTokens,
          limitChatbots: subscription.maxChatbotsAllowed,
          limitMessages: subscription.userMessageRateLimit,
          limitPages: subscription.maxPagesAllowed,
        });
      }
    }
  } catch (error) {
    console.error("Failed to log usage:", error);
    // Don't throw - usage logging failure shouldn't block the query
  }
}

/**
 * Main chat query handler
 * POST /api/chat/query
 */
const handleChatQuery = asyncHandler(async (req, res) => {
  const startTime = Date.now();
  // Only extract chatbot_id and query from request body
  const { chatbot_id, query } = req.body;

  // Validate required fields
  if (!chatbot_id || !query) {
    throw new ApiError(400, "chatbot_id and query are required");
  }

  // Get origin domain from request
  const originDomain = req.headers.origin || req.headers.referer || "unknown";
  const sessionId = req.headers["x-session-id"] || req.body.session_id;

  // 1. Validate chatbot exists
  const [chatbot] = await db
    .select()
    .from(userChatbots)
    .where(eq(userChatbots.id, chatbot_id))
    .limit(1);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // 1.5. Fetch chatbot settings from database
  const [generalSettings] = await db
    .select()
    .from(userChatbotSettingsGeneral)
    .where(eq(userChatbotSettingsGeneral.chatbotId, chatbot_id))
    .limit(1);

  // Extract LLM configuration from database with fallback defaults
  const provider = "openai"; // Default provider
  const llm_model = generalSettings?.llmModel || "gpt-5-nano";
  const top_k = 2; // Default top_k for retrieval
  const temperature = 0.7; // Default temperature
  const words = 120; // Default response length

  // 2. Check widget configuration
  const [widgetConfig] = await db
    .select()
    .from(chatbotWidgetConfig)
    .where(eq(chatbotWidgetConfig.chatbotId, chatbot_id))
    .limit(1);

  // Check if widget is enabled
  if (widgetConfig && !widgetConfig.widgetEnabled) {
    throw new ApiError(403, "Widget is disabled for this chatbot");
  }

  // Validate domain whitelist
  if (widgetConfig?.allowedDomains && widgetConfig.allowedDomains.length > 0) {
    const isAllowed = widgetConfig.allowedDomains.some((domain) =>
      originDomain.includes(domain)
    );

    if (!isAllowed) {
      // Log unauthorized access attempt
      await db.insert(chatbotWidgetInteractions).values({
        chatbotId: chatbot_id,
        interactionType: "ERROR",
        queryText: query,
        errorOccurred: true,
        errorMessage: `Unauthorized domain: ${originDomain}`,
      });

      throw new ApiError(
        403,
        "Domain not authorized. Please contact the chatbot owner."
      );
    }
  }

  // 3. Check rate limits
  const rateLimitInfo = await checkRateLimit(chatbot_id, "messages");

  if (!rateLimitInfo.allowed) {
    res.setHeader("X-RateLimit-Limit", rateLimitInfo.limit);
    res.setHeader("X-RateLimit-Remaining", 0);
    res.setHeader("Retry-After", rateLimitInfo.retryAfter);

    throw new ApiError(
      429,
      `Rate limit exceeded. Please try again in ${rateLimitInfo.retryAfter} seconds.`
    );
  }

  // Set rate limit headers
  res.setHeader("X-RateLimit-Limit", rateLimitInfo.limit || 1000);
  res.setHeader("X-RateLimit-Remaining", rateLimitInfo.remaining || 999);

  // 4. Get account and subscription info
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, chatbot.accountId))
    .limit(1);

  if (!account) {
    throw new ApiError(404, "Account not found");
  }

  const [subscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(
      and(
        eq(usersSubscriptions.userId, account.ownerId),
        eq(usersSubscriptions.status, "active")
      )
    )
    .limit(1);

  // Check if user has messages remaining
  if (subscription) {
    const [usage] = await db
      .select()
      .from(usersUsageTracking)
      .where(
        and(
          eq(usersUsageTracking.userId, account.ownerId),
          eq(usersUsageTracking.subscriptionId, subscription.id),
          eq(usersUsageTracking.periodStart, subscription.currentPeriodStart)
        )
      )
      .limit(1);

    if (usage && usage.messagesReceived >= usage.limitMessages) {
      throw new ApiError(
        429,
        "Message limit exceeded for this billing period. Please upgrade your plan."
      );
    }
  }

  // 5. Get LLM model info for cost calculation
  const [llmModelInfo] = await db
    .select()
    .from(websiteLlmModels)
    .where(
      and(
        eq(websiteLlmModels.provider, provider || "openai"),
        eq(websiteLlmModels.title, llm_model || "gpt-5-nano"),
        eq(websiteLlmModels.isActive, true)
      )
    )
    .limit(1);

  // 6. Prepare request to AWS Lambda
  const lambdaPayload = {
    chatbot_id,
    query,
    provider: provider || "openai",
    llm_model: llm_model || "gpt-5-nano",
    top_k: top_k || 2,
    temperature: temperature || 0.7,
    words: words || 120,
    vector_namespace: chatbot.vectorNamespace,
  };

  let response;
  let lambdaError = null;

  try {
    // 7. Call AWS Lambda endpoint
    const lambdaResponse = await axios.post(
      "https://i1m04cdjgd.execute-api.us-east-1.amazonaws.com/query",
      lambdaPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30 second timeout
      }
    );

    response = lambdaResponse.data;
  } catch (error) {
    lambdaError = error.message;
    console.error("Lambda request failed:", error);

    // Log error interaction
    await db.insert(chatbotWidgetInteractions).values({
      chatbotId: chatbot_id,
      interactionType: "ERROR",
      queryText: query,
      llmModelUsed: llm_model || "gpt-5-nano",
      errorOccurred: true,
      errorMessage: lambdaError,
      responseTimeMs: Date.now() - startTime,
    });

    throw new ApiError(500, "Failed to process query. Please try again later.");
  }

  // 8. Calculate costs and tokens (estimate if not provided by Lambda)
  const inputTokens = response.input_tokens || Math.ceil(query.length / 4);
  const outputTokens =
    response.output_tokens || Math.ceil((response.answer?.length || 0) / 4);
  const totalTokens = inputTokens + outputTokens;

  let cost = 0;
  if (llmModelInfo) {
    cost =
      (inputTokens / 1000) * parseFloat(llmModelInfo.inputCostPer1k) +
      (outputTokens / 1000) * parseFloat(llmModelInfo.outputCostPer1k);
  }

  // 9. Increment rate limit
  await incrementRateLimit(rateLimitInfo, chatbot_id);

  // 10. Update session message count
  if (sessionId) {
    const [session] = await db
      .select()
      .from(chatbotWidgetSessions)
      .where(
        and(
          eq(chatbotWidgetSessions.chatbotId, chatbot_id),
          eq(chatbotWidgetSessions.sessionId, sessionId)
        )
      )
      .limit(1);

    if (session) {
      await db
        .update(chatbotWidgetSessions)
        .set({
          messagesCount: sql`${chatbotWidgetSessions.messagesCount} + 1`,
          lastActivityAt: sql`now()`,
        })
        .where(eq(chatbotWidgetSessions.id, session.id));
    }
  }

  // 11. Log interaction
  const [interaction] = await db
    .insert(chatbotWidgetInteractions)
    .values({
      chatbotId: chatbot_id,
      sessionId: sessionId
        ? (
            await db
              .select()
              .from(chatbotWidgetSessions)
              .where(
                and(
                  eq(chatbotWidgetSessions.chatbotId, chatbot_id),
                  eq(chatbotWidgetSessions.sessionId, sessionId)
                )
              )
              .limit(1)
          )[0]?.id
        : null,
      interactionType: "QUERY",
      queryText: widgetConfig?.logConversations ? query : null,
      responseText: widgetConfig?.logConversations ? response.answer : null,
      llmModelUsed: llm_model || "gpt-4o-mini",
      responseTimeMs: Date.now() - startTime,
      tokensUsed: totalTokens,
      errorOccurred: false,
    })
    .returning();

  // 12. Log usage for billing
  await logUsageEvent(
    chatbot_id,
    chatbot.accountId,
    llmModelInfo?.id,
    inputTokens,
    outputTokens,
    cost,
    interaction.id
  );

  // 13. Return response
  res.status(200).json(
    new ApiResponse(200, {
      answer: response.answer,
      sources: response.sources || [],
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      model: llm_model || "gpt-4o-mini",
      responseTime: Date.now() - startTime,
    })
  );
});

/**
 * Handle user feedback on responses
 * POST /api/chat/feedback
 */
const handleChatFeedback = asyncHandler(async (req, res) => {
  const { chatbot_id, session_id, interaction_id, feedback_type, comment } =
    req.body;

  if (!chatbot_id || !feedback_type) {
    throw new ApiError(400, "chatbot_id and feedback_type are required");
  }

  // Validate chatbot exists
  const [chatbot] = await db
    .select()
    .from(userChatbots)
    .where(eq(userChatbots.id, chatbot_id))
    .limit(1);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Log feedback as interaction
  await db.insert(chatbotWidgetInteractions).values({
    chatbotId: chatbot_id,
    interactionType: "FEEDBACK",
    queryText: `Feedback: ${feedback_type}${comment ? " - " + comment : ""}`,
  });

  res
    .status(200)
    .json(new ApiResponse(200, null, "Feedback recorded successfully"));
});

export { handleChatQuery, handleChatFeedback };
