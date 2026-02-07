import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, sql, and, desc, count, sum } from "drizzle-orm";
import crypto from "crypto";

// Import schema tables from drizzle
import {
  users,
  usersSubscriptions,
  websitePromotionReferral,
  usersPromotionReferrals,
} from "../../drizzle/schema.ts";

// ────────────────────────────────────────────────
//   Helper Functions
// ────────────────────────────────────────────────

/**
 * Calculate cycle key based on cycle type
 * @param {string} cycleType - LIFETIME | MONTHLY | WEEKLY
 * @returns {Date} - Cycle key date
 */
function calculateCycleKey(cycleType) {
  const now = new Date();

  if (cycleType === "LIFETIME") {
    return new Date("2000-01-01"); // Fixed date for lifetime
  } else if (cycleType === "MONTHLY") {
    // First day of current month
    return new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (cycleType === "WEEKLY") {
    // First day of current week (Monday)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(now.setDate(diff));
  }

  return new Date("2000-01-01"); // Default to lifetime
}

/**
 * Generate unique promo code
 */
function generateUniqueCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

/**
 * Check if user is new (no previous subscriptions)
 */
async function isNewUser(userId) {
  const [existingSubscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(eq(usersSubscriptions.userId, userId))
    .limit(1);

  return !existingSubscription;
}

/**
 * Validate promo code and check eligibility
 * Returns promotion details if valid, throws error otherwise
 */
export async function validatePromoCode(code, userId) {
  // Find active promotion by code
  const [promotion] = await db
    .select()
    .from(websitePromotionReferral)
    .where(
      and(
        eq(websitePromotionReferral.promoCode, code),
        eq(websitePromotionReferral.isActive, true)
      )
    )
    .limit(1);

  if (!promotion) {
    throw new ApiError(404, "Invalid or inactive promo code");
  }

  // Check if expired
  if (promotion.expiresAt && new Date(promotion.expiresAt) < new Date()) {
    throw new ApiError(400, "Promo code has expired");
  }

  // Check if not yet started
  if (promotion.startsAt && new Date(promotion.startsAt) > new Date()) {
    throw new ApiError(400, "Promo code is not yet active");
  }

  // Check target audience
  const userIsNew = await isNewUser(userId);

  if (promotion.targetAudience === "NEW_USERS" && !userIsNew) {
    throw new ApiError(400, "This promo code is only for new users");
  }

  if (promotion.targetAudience === "EXISTING_USERS" && userIsNew) {
    throw new ApiError(400, "This promo code is only for existing users");
  }

  // For REFERRAL type, check if user already used this code
  if (promotion.promotionType === "REFERRAL") {
    const [existingReferral] = await db
      .select()
      .from(usersPromotionReferrals)
      .where(
        and(
          eq(usersPromotionReferrals.referredUserId, userId),
          eq(usersPromotionReferrals.promotionId, promotion.id)
        )
      )
      .limit(1);

    if (existingReferral) {
      throw new ApiError(400, "You have already used this referral code");
    }
  }

  return promotion;
}

/**
 * Check and apply milestone rewards for a referrer
 */

// How it works:
// If the promotion is MONTHLY, the code generates a key like 2026-02-01 (Feb 1st).
// When checking regular rewards or milestones, the code only counts referrals that have this exact cycleKey.
// As soon as March starts, the code generates a new key 2026-03-01.
// The count for the new month starts at 0, effectively resetting the tiers so users can earn the "5 referrals" bonus again in the new month.

async function checkAndApplyMilestones(referrerId, promotionId, newReferralId) {
  // Get promotion details
  const [promotion] = await db
    .select()
    .from(websitePromotionReferral)
    .where(eq(websitePromotionReferral.id, promotionId))
    .limit(1);

  if (!promotion || !promotion.milestoneRewards) {
    return;
  }

  // Parse milestones i.e. stored as JSONB inside the users_promotion_referrals table
  const milestones = promotion.milestoneRewards;

  if (!Array.isArray(milestones) || milestones.length === 0) {
    // No milestone acheived yet
    return;
  }

  // Calculate cycle key
  const cycleKey = calculateCycleKey(promotion.cycleType);

  // Count successful referrals in current cycle
  const [result] = await db
    .select({ count: count() })
    .from(usersPromotionReferrals)
    .where(
      and(
        eq(usersPromotionReferrals.referrerUserId, referrerId),
        eq(usersPromotionReferrals.promotionId, promotionId),
        eq(usersPromotionReferrals.status, "SUCCESSFUL"),
        eq(usersPromotionReferrals.cycleKey, cycleKey)
      )
    );

  const totalReferrals = result.count || 0;

  // Check which milestones are triggered
  const triggeredMilestones = milestones.filter(
    (m) => m.count === totalReferrals
  );

  if (triggeredMilestones.length === 0) {
    return;
  }

  // Get referrer's active subscription
  const [subscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(
      and(
        eq(usersSubscriptions.userId, referrerId),
        sql`${usersSubscriptions.status} IN ('active', 'trialing')`
      )
    )
    .orderBy(desc(usersSubscriptions.createdAt))
    .limit(1);

  if (!subscription) {
    console.log(`No active subscription found for referrer ${referrerId}`);
    return;
  }

  // Apply milestone rewards
  for (const milestone of triggeredMilestones) {
    const bonusMessages = milestone.messages || 0;
    const bonusPages = milestone.pages || 0;

    // Update subscription with milestone bonus
    await db
      .update(usersSubscriptions)
      .set({
        bonusMessages: sql`${usersSubscriptions.bonusMessages} + ${bonusMessages}`,
        bonusPages: sql`${usersSubscriptions.bonusPages} + ${bonusPages}`,
        bonusTitle: `Milestone: ${milestone.description || `${milestone.count} referrals`}`,
        updatedAt: new Date(),
      })
      .where(eq(usersSubscriptions.id, subscription.id));

    console.log(
      `Applied milestone ${milestone.count} to referrer ${referrerId}: +${bonusMessages} messages, +${bonusPages} pages`
    );
  }

  // Record triggered milestones in the referral record
  const milestoneRecords = triggeredMilestones.map((m) => ({
    milestone_count: m.count,
    triggered_at: new Date().toISOString(),
    messages_awarded: m.messages || 0,
    pages_awarded: m.pages || 0,
    referral_id: newReferralId,
  }));

  await db
    .update(usersPromotionReferrals)
    .set({
      triggeredMilestones: milestoneRecords,
      updatedAt: new Date(),
    })
    .where(eq(usersPromotionReferrals.id, newReferralId));
}

/**
 * Process promotion reward after successful transaction
 * Called by billing webhook handler
 */
export async function processPromotionReward(
  promoCode,
  userId,
  subscriptionId,
  transactionId
) {
  // Get promotion details
  const [promotion] = await db
    .select()
    .from(websitePromotionReferral)
    .where(eq(websitePromotionReferral.promoCode, promoCode))
    .limit(1);

  if (!promotion) {
    console.error(`Promotion not found for code: ${promoCode}`);
    return;
  }

  const cycleKey = calculateCycleKey(promotion.cycleType);

  // Handle REFERRAL type
  if (promotion.promotionType === "REFERRAL") {
    // Find pending referral record
    const [referral] = await db
      .select()
      .from(usersPromotionReferrals)
      .where(
        and(
          eq(usersPromotionReferrals.referredUserId, userId),
          eq(usersPromotionReferrals.promotionId, promotion.id),
          eq(usersPromotionReferrals.status, "PENDING")
        )
      )
      .limit(1);

    if (!referral) {
      console.error(`No pending referral found for user ${userId}`);
      return;
    }

    // Calculate rewards based on reward_target
    let referrerMessages = 0;
    let referrerPages = 0;
    let referredMessages = 0;
    let referredPages = 0;

    if (
      promotion.rewardTarget === "REFERRER" ||
      promotion.rewardTarget === "BOTH"
    ) {
      referrerMessages = promotion.messageAdded || 0;
      referrerPages = promotion.pagesAdded || 0;
    }

    if (
      promotion.rewardTarget === "REFERRED" ||
      promotion.rewardTarget === "BOTH"
    ) {
      referredMessages = promotion.messageAdded || 0;
      referredPages = promotion.pagesAdded || 0;
    }

    // Update referral record to SUCCESSFUL
    await db
      .update(usersPromotionReferrals)
      .set({
        status: "SUCCESSFUL",
        confirmedAt: new Date(),
        subscriptionId: subscriptionId,
        referrerMessages: referrerMessages,
        referrerPages: referrerPages,
        referredMessages: referredMessages,
        referredPages: referredPages,
        updatedAt: new Date(),
      })
      .where(eq(usersPromotionReferrals.id, referral.id));

    // Apply bonus to referred user's subscription
    if (referredMessages > 0 || referredPages > 0) {
      await db
        .update(usersSubscriptions)
        .set({
          bonusMessages: sql`${usersSubscriptions.bonusMessages} + ${referredMessages}`,
          bonusPages: sql`${usersSubscriptions.bonusPages} + ${referredPages}`,
          bonusTitle: `Referral bonus: ${promotion.promotionShareText}`,
          updatedAt: new Date(),
        })
        .where(eq(usersSubscriptions.id, subscriptionId));
    }

    // Apply bonus to referrer's subscription
    if (referrerMessages > 0 || referrerPages > 0) {
      const [referrerSubscription] = await db
        .select()
        .from(usersSubscriptions)
        .where(
          and(
            eq(usersSubscriptions.userId, referral.referrerUserId),
            sql`${usersSubscriptions.status} IN ('active', 'trialing')`
          )
        )
        .orderBy(desc(usersSubscriptions.createdAt))
        .limit(1);

      if (referrerSubscription) {
        await db
          .update(usersSubscriptions)
          .set({
            bonusMessages: sql`${usersSubscriptions.bonusMessages} + ${referrerMessages}`,
            bonusPages: sql`${usersSubscriptions.bonusPages} + ${referrerPages}`,
            bonusTitle: `Referral reward: ${promotion.promotionShareText}`,
            updatedAt: new Date(),
          })
          .where(eq(usersSubscriptions.id, referrerSubscription.id));
      }
      // TODO: Send notification email/push
      // await emailService.sendReferralRewardEmail({
      //    userId: referral.referrerUserId,
      //    bonus: { messages: referrerMessages, pages: referrerPages }
      // });
    }

    // Check and apply milestone rewards
    await checkAndApplyMilestones(
      referral.referrerUserId,
      promotion.id,
      referral.id
    );
  }
  // Handle DIRECT promo type
  else if (promotion.promotionType === "DIRECT") {
    // Apply signup bonus
    const signupMessages = promotion.signupMessagesBonus || 0;
    const signupPages = promotion.signupPagesBonus || 0;

    if (signupMessages > 0 || signupPages > 0) {
      await db
        .update(usersSubscriptions)
        .set({
          bonusMessages: sql`${usersSubscriptions.bonusMessages} + ${signupMessages}`,
          bonusPages: sql`${usersSubscriptions.bonusPages} + ${signupPages}`,
          bonusTitle: `Promo: ${promotion.promotionShareText}`,
          updatedAt: new Date(),
        })
        .where(eq(usersSubscriptions.id, subscriptionId));
    }
  }

  console.log(
    `Successfully processed promotion reward for user ${userId} with code ${promoCode}`
  );
}

// ────────────────────────────────────────────────
//   Core Controllers
// ────────────────────────────────────────────────

/**
 * POST /api/v1/referrals/generate
 * Generate a unique referral code/link for the authenticated user
 */
// Why promotionId is required to generate code? (referral.controller.js:L391)
// We require it because you might run multiple referral campaigns at once.

// Example 1: "Standard Monthly Referral" (Earn 10 credits)
// Example 2: "Influencer Special" (Earn 50 credits)
// Example 3: "Black Friday Referral" (Double rewards)
export const generateReferralCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { promotionId } = req.body;

  if (!promotionId) {
    throw new ApiError(400, "Promotion ID is required");
  }

  // Verify promotion exists and is active
  const [promotion] = await db
    .select()
    .from(websitePromotionReferral)
    .where(
      and(
        eq(websitePromotionReferral.id, promotionId),
        eq(websitePromotionReferral.isActive, true),
        eq(websitePromotionReferral.promotionType, "REFERRAL")
      )
    )
    .limit(1);

  if (!promotion) {
    throw new ApiError(404, "Promotion not found or not active");
  }

  // Generate unique referral link
  const baseCode = promotion.promoCode || generateUniqueCode();
  const userCode = `${baseCode}_${userId.substring(0, 8)}`;

  // Create referral link
  const referralLink = `${process.env.FRONTEND_URL}/signup?ref=${userCode}`;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        referralCode: userCode,
        referralLink: referralLink,
        promotion: {
          id: promotion.id,
          shareText: promotion.promotionShareText,
          rewardMessages: promotion.messageAdded,
          rewardPages: promotion.pagesAdded,
          rewardTarget: promotion.rewardTarget,
        },
      },
      "Referral code generated successfully"
    )
  );
});

/**
 * POST /api/v1/referrals/apply
 * Apply a referral code (creates PENDING record)
 */
export const applyReferralCode = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { referralCode } = req.body;

  if (!referralCode) {
    throw new ApiError(400, "Referral code is required");
  }

  // Extract base promo code and referrer ID from referral code
  // Format: PROMOCODE_referrerId
  const parts = referralCode.split("_");
  if (parts.length < 2) {
    throw new ApiError(400, "Invalid referral code format");
  }

  const baseCode = parts[0];
  const referrerIdPrefix = parts[1];

  // Find promotion
  const [promotion] = await db
    .select()
    .from(websitePromotionReferral)
    .where(
      and(
        eq(websitePromotionReferral.promoCode, baseCode),
        eq(websitePromotionReferral.isActive, true),
        eq(websitePromotionReferral.promotionType, "REFERRAL")
      )
    )
    .limit(1);

  if (!promotion) {
    throw new ApiError(404, "Invalid referral code");
  }

  // Find referrer user by ID prefix
  const [referrer] = await db
    .select()
    .from(users)
    .where(sql`${users.id}::text LIKE ${referrerIdPrefix + "%"}`)
    .limit(1);

  if (!referrer) {
    throw new ApiError(404, "Referrer not found");
  }

  // Check for self-referral
  if (referrer.id === userId) {
    throw new ApiError(400, "You cannot use your own referral code");
  }

  // Validate promo code for this user
  await validatePromoCode(baseCode, userId);

  // Calculate cycle key
  const cycleKey = calculateCycleKey(promotion.cycleType);

  // Create PENDING referral record
  const [referralRecord] = await db
    .insert(usersPromotionReferrals)
    .values({
      referrerUserId: referrer.id,
      referredUserId: userId,
      promotionId: promotion.id,
      cycleKey: cycleKey,
      status: "PENDING",
      redeemedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        referralId: referralRecord.id,
        status: "PENDING",
        message:
          "Referral code applied! Complete your purchase to activate the bonus.",
        promotion: {
          shareText: promotion.promotionShareText,
          rewardMessages: promotion.messageAdded,
          rewardPages: promotion.pagesAdded,
        },
      },
      "Referral code applied successfully"
    )
  );
});

/**
 * GET /api/v1/referrals/my-referrals
 * List all referrals made by the authenticated user
 */

// he status comes from the Frontend (UI) to filter the list. Accepted values (from your schema):

// PENDING: "Friends who signed up but haven't paid yet."
// SUCCESSFUL: "Friends who paid; you got your reward."
// EXPIRED / CANCELED: "Did not complete."
export const listMyReferrals = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, limit = 50, offset = 0 } = req.query;

  // Build query conditions
  const conditions = [eq(usersPromotionReferrals.referrerUserId, userId)];

  if (status) {
    conditions.push(eq(usersPromotionReferrals.status, status));
  }

  // Fetch referrals with user details
  const referrals = await db
    .select({
      id: usersPromotionReferrals.id,
      referredUserId: usersPromotionReferrals.referredUserId,
      referredUserEmail: users.email,
      referredUserName: users.name,
      status: usersPromotionReferrals.status,
      redeemedAt: usersPromotionReferrals.redeemedAt,
      confirmedAt: usersPromotionReferrals.confirmedAt,
      referrerMessages: usersPromotionReferrals.referrerMessages,
      referrerPages: usersPromotionReferrals.referrerPages,
      triggeredMilestones: usersPromotionReferrals.triggeredMilestones,
      promotionShareText: websitePromotionReferral.promotionShareText,
    })
    .from(usersPromotionReferrals)
    .innerJoin(users, eq(usersPromotionReferrals.referredUserId, users.id))
    .innerJoin(
      websitePromotionReferral,
      eq(usersPromotionReferrals.promotionId, websitePromotionReferral.id)
    )
    .where(and(...conditions))
    .orderBy(desc(usersPromotionReferrals.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  // Get total count
  const [{ total }] = await db
    .select({ total: count() })
    .from(usersPromotionReferrals)
    .where(and(...conditions));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        referrals,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + referrals.length < total,
        },
      },
      "Referrals fetched successfully"
    )
  );
});

/**
 * GET /api/v1/referrals/stats
 * Get referral statistics for the authenticated user
 */
export const getReferralStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get counts by status
  const stats = await db
    .select({
      status: usersPromotionReferrals.status,
      count: count(),
      totalMessages: sum(usersPromotionReferrals.referrerMessages),
      totalPages: sum(usersPromotionReferrals.referrerPages),
    })
    .from(usersPromotionReferrals)
    .where(eq(usersPromotionReferrals.referrerUserId, userId))
    .groupBy(usersPromotionReferrals.status);

  // Calculate totals
  const totalReferrals = stats.reduce((acc, s) => acc + (s.count || 0), 0);
  const successfulReferrals =
    stats.find((s) => s.status === "SUCCESSFUL")?.count || 0;
  const pendingReferrals =
    stats.find((s) => s.status === "PENDING")?.count || 0;
  const totalMessagesEarned = stats.reduce(
    (acc, s) => acc + (parseInt(s.totalMessages) || 0),
    0
  );
  const totalPagesEarned = stats.reduce(
    (acc, s) => acc + (parseInt(s.totalPages) || 0),
    0
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        totalReferrals,
        successfulReferrals,
        pendingReferrals,
        totalMessagesEarned,
        totalPagesEarned,
        statsByStatus: stats,
      },
      "Referral statistics fetched successfully"
    )
  );
});

// export {
//   generateReferralCode,
//   applyReferralCode,
//   listMyReferrals,
//   getReferralStats,
//   validatePromoCode,
//   processPromotionReward,
// };

// 1. CycleKey & Monthly Reset (referral.controller.js:L147)
// Yes, you are exactly right. The cycleKey in the code implements your "repetition tier settle to 0" concept perfectly.

// -- 1. Create a "Monthly Referral Program" (Milestones: 2 & 5 referrals)
// INSERT INTO website_promotion_referral (
//     promotion_share_text, promo_code, message_added, pages_added,
//     reward_target, is_active, target_audience, cycle_type, promotion_type,
//     milestone_rewards
// ) VALUES (
//     'Invite friends & earn monthly rewards!', -- Share text
//     'REF2026',                               -- Base code prefix
//     10, 5,                                   -- Base reward per referral (10 msgs, 5 pages)
//     'BOTH',                                  -- Both referrer & referee get base reward
//     TRUE, 'NEW_USERS', 'MONTHLY', 'REFERRAL', -- Monthly cycle!
//     '[
//         {"count": 2, "messages": 50, "pages": 20, "description": "2 Referrals Bonus"},
//         {"count": 5, "messages": 100, "pages": 50, "description": "5 Referrals Super Bonus"}
//     ]'::JSONB
// );

// -- 2. Create a "Launch Promo Code" (One-time use)
// INSERT INTO website_promotion_referral (
//     promotion_share_text, promo_code,
//     signup_messages_bonus, signup_pages_bonus, -- Uses distinct bonus columns
//     is_active, target_audience, cycle_type, promotion_type
// ) VALUES (
//     'Launch Special: Get 500 extra messages!',
//     'LAUNCH500',
//     500, 100,
//     TRUE, 'NEW_USERS', 'LIFETIME', 'DIRECT' -- Direct type, no cycle
// );
