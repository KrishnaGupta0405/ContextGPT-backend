import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, and, sql } from "drizzle-orm";
import {
  userChatbots,
  userChatbotAppearanceUi,
  userChatbotBehavior,
  chatbotWidgetConfig,
  chatbotWidgetSessions,
} from "../../drizzle/schema.ts";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ==============================================
 * WIDGET CONFIGURATION MANAGEMENT
 * ==============================================
 */

// GET widget configuration for a chatbot
const getWidgetConfig = asyncHandler(async (req, res) => {
  const { chatbotId } = req.params;

  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  // Verify chatbot exists
  const [chatbot] = await db
    .select()
    .from(userChatbots)
    .where(eq(userChatbots.id, chatbotId))
    .limit(1);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Get widget config
  const [config] = await db
    .select()
    .from(chatbotWidgetConfig)
    .where(eq(chatbotWidgetConfig.chatbotId, chatbotId))
    .limit(1);

  // Get appearance settings
  const [appearance] = await db
    .select()
    .from(userChatbotAppearanceUi)
    .where(eq(userChatbotAppearanceUi.chatbotId, chatbotId))
    .limit(1);

  // Get behavior settings
  const [behavior] = await db
    .select()
    .from(userChatbotBehavior)
    .where(eq(userChatbotBehavior.chatbotId, chatbotId))
    .limit(1);

  res.status(200).json(
    new ApiResponse(200, {
      chatbot: {
        id: chatbot.id,
        name: chatbot.name,
      },
      config: config || {
        widgetEnabled: true,
        widgetVersion: "v1",
        logConversations: true,
        enableAnalytics: true,
      },
      appearance: appearance || {},
      behavior: behavior || {},
    })
  );
});

// POST/PUT update widget configuration (authenticated - chatbot owner only)
const updateWidgetConfig = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;
  const { allowedDomains, widgetEnabled, logConversations, enableAnalytics } =
    req.body;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  // Import permission check from chatbot controller
  const { belongsToAccountMemberList } =
    await import("./chatbot.controller.js");
  await belongsToAccountMemberList(accountId, userId);

  // Verify chatbot belongs to account
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

  // Check if config exists
  const [existingConfig] = await db
    .select()
    .from(chatbotWidgetConfig)
    .where(eq(chatbotWidgetConfig.chatbotId, chatbotId))
    .limit(1);

  let result;

  if (existingConfig) {
    // Update existing config
    result = await db
      .update(chatbotWidgetConfig)
      .set({
        allowedDomains,
        widgetEnabled,
        logConversations,
        enableAnalytics,
        updatedAt: sql`now()`,
      })
      .where(eq(chatbotWidgetConfig.chatbotId, chatbotId))
      .returning();
  } else {
    // Create new config
    result = await db
      .insert(chatbotWidgetConfig)
      .values({
        chatbotId,
        allowedDomains,
        widgetEnabled,
        logConversations,
        enableAnalytics,
      })
      .returning();
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        result[0],
        "Widget configuration updated successfully"
      )
    );
});

/**
 * ==============================================
 * WIDGET SESSION TRACKING
 * ==============================================
 */

// POST create/update widget session
const trackWidgetSession = asyncHandler(async (req, res) => {
  const { chatbotId } = req.params;
  const { sessionId, originDomain, metadata } = req.body;

  if (!chatbotId || !sessionId) {
    throw new ApiError(400, "Chatbot ID and Session ID are required");
  }

  // Verify chatbot exists and widget is enabled
  const [chatbot] = await db
    .select()
    .from(userChatbots)
    .where(eq(userChatbots.id, chatbotId))
    .limit(1);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Check widget config
  const [config] = await db
    .select()
    .from(chatbotWidgetConfig)
    .where(eq(chatbotWidgetConfig.chatbotId, chatbotId))
    .limit(1);

  if (config && !config.widgetEnabled) {
    throw new ApiError(403, "Widget is disabled for this chatbot");
  }

  // Validate domain if whitelist exists
  if (config?.allowedDomains && config.allowedDomains.length > 0) {
    const isAllowed = config.allowedDomains.some((domain) =>
      originDomain?.includes(domain)
    );

    if (!isAllowed) {
      throw new ApiError(
        403,
        "Domain not allowed. Please contact the chatbot owner."
      );
    }
  }

  // Get user agent and IP from request
  const userAgent = req.headers["user-agent"];
  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress;

  // Check if session exists
  const [existingSession] = await db
    .select()
    .from(chatbotWidgetSessions)
    .where(
      and(
        eq(chatbotWidgetSessions.chatbotId, chatbotId),
        eq(chatbotWidgetSessions.sessionId, sessionId)
      )
    )
    .limit(1);

  let result;

  if (existingSession) {
    // Update existing session
    result = await db
      .update(chatbotWidgetSessions)
      .set({
        lastActivityAt: sql`now()`,
        metadata,
      })
      .where(eq(chatbotWidgetSessions.id, existingSession.id))
      .returning();
  } else {
    // Create new session
    result = await db
      .insert(chatbotWidgetSessions)
      .values({
        chatbotId,
        sessionId,
        originDomain,
        userAgent,
        ipAddress,
        metadata,
        lastActivityAt: sql`now()`,
      })
      .returning();
  }

  res.status(200).json(new ApiResponse(200, result[0], "Session tracked"));
});

// GET widget analytics for chatbot owner
const getWidgetAnalytics = asyncHandler(async (req, res) => {
  const { accountId, chatbotId } = req.params;
  const { userId } = req.user;
  const { startDate, endDate } = req.query;

  if (!accountId || !chatbotId) {
    throw new ApiError(400, "Account ID and Chatbot ID are required");
  }

  // Import permission check
  const { belongsToAccountMemberList } =
    await import("./chatbot.controller.js");
  await belongsToAccountMemberList(accountId, userId);

  // Build date filter
  let dateFilter = sql`1=1`;
  if (startDate) {
    dateFilter = sql`${chatbotWidgetSessions.startedAt} >= ${startDate}`;
  }
  if (endDate) {
    dateFilter = sql`${dateFilter} AND ${chatbotWidgetSessions.startedAt} <= ${endDate}`;
  }

  // Get session statistics
  const sessions = await db
    .select({
      totalSessions: sql`COUNT(*)`,
      totalMessages: sql`SUM(${chatbotWidgetSessions.messagesCount})`,
      uniqueDomains: sql`COUNT(DISTINCT ${chatbotWidgetSessions.originDomain})`,
      avgMessagesPerSession: sql`AVG(${chatbotWidgetSessions.messagesCount})`,
    })
    .from(chatbotWidgetSessions)
    .where(and(eq(chatbotWidgetSessions.chatbotId, chatbotId), dateFilter));

  // Get recent sessions
  const recentSessions = await db
    .select()
    .from(chatbotWidgetSessions)
    .where(eq(chatbotWidgetSessions.chatbotId, chatbotId))
    .orderBy(sql`${chatbotWidgetSessions.startedAt} DESC`)
    .limit(10);

  res.status(200).json(
    new ApiResponse(200, {
      statistics: sessions[0],
      recentSessions,
    })
  );
});

/**
 * ==============================================
 * WIDGET SCRIPT DELIVERY
 * ==============================================
 */

// GET widget JavaScript file
const serveWidgetScript = asyncHandler(async (req, res) => {
  const { chatbotId } = req.params;

  if (!chatbotId) {
    throw new ApiError(400, "Chatbot ID is required");
  }

  // Verify chatbot exists
  const [chatbot] = await db
    .select()
    .from(userChatbots)
    .where(eq(userChatbots.id, chatbotId))
    .limit(1);

  if (!chatbot) {
    throw new ApiError(404, "Chatbot not found");
  }

  // Get widget config
  const [config] = await db
    .select()
    .from(chatbotWidgetConfig)
    .where(eq(chatbotWidgetConfig.chatbotId, chatbotId))
    .limit(1);

  if (config && !config.widgetEnabled) {
    throw new ApiError(403, "Widget is disabled for this chatbot");
  }

  // Get appearance and behavior settings
  const [appearance] = await db
    .select()
    .from(userChatbotAppearanceUi)
    .where(eq(userChatbotAppearanceUi.chatbotId, chatbotId))
    .limit(1);

  const [behavior] = await db
    .select()
    .from(userChatbotBehavior)
    .where(eq(userChatbotBehavior.chatbotId, chatbotId))
    .limit(1);

  // Read widget.js and style.css files
  const widgetJsPath = path.join(__dirname, "../../public/widget/widget.js");
  const styleCssPath = path.join(__dirname, "../../public/widget/style.css");

  let widgetJsContent = fs.readFileSync(widgetJsPath, "utf-8");
  const styleCssContent = fs.readFileSync(styleCssPath, "utf-8");

  // Replace placeholders in widget.js
  widgetJsContent = widgetJsContent
    .replace(/\$\{chatbotId\}/g, chatbotId)
    .replace(
      /\$\{process\.env\.API_BASE_URL \|\| "[^"]*"\}/g,
      process.env.API_BASE_URL || "http://localhost:8000"
    )
    .replace(
      /\$\{config\?\.widgetVersion \|\| "[^"]*"\}/g,
      config?.widgetVersion || "v1"
    )
    .replace(
      /\{\}\s*\/\*\s*\[\[CHATBOT_DATA\]\]\s*\*\//g,
      JSON.stringify({
        id: chatbot.id,
        name: chatbot.name,
      })
    )
    .replace(
      /\{\}\s*\/\*\s*\[\[APPEARANCE_DATA\]\]\s*\*\//g,
      JSON.stringify(appearance || {})
    )
    .replace(
      /\{\}\s*\/\*\s*\[\[BEHAVIOR_DATA\]\]\s*\*\//g,
      JSON.stringify(behavior || {})
    );

  // Inject CSS content into the style.textContent placeholder
  widgetJsContent = widgetJsContent.replace(
    /\/\*\s*\[\[STYLE_DATA\]\]\s*\*\//,
    styleCssContent.replace(/`/g, "\\`").replace(/\$/g, "\\$")
  );

  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
  res.send(widgetJsContent);
});

export {
  getWidgetConfig,
  updateWidgetConfig,
  trackWidgetSession,
  getWidgetAnalytics,
  serveWidgetScript,
};
