// middlewares/subscription.middleware.js
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../index.js";
import {
  usersSubscriptions,
  usersUsageTracking,
} from "../../drizzle/schema.ts";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
/**
 * Middleware to check if user has a valid subscription (active or trialing)
 * and hasn't exceeded their page indexing limit.
 *
 * This middleware should be used before file upload operations.
 * It requires req.user.id to be set (use verifyJWT middleware first).
 */
export const checkSubscriptionAndPageLimit = asyncHandler(
  async (req, res, next) => {
    const userId = req.user.id;

    if (!userId) {
      throw new ApiError(401, "User not authenticated");
    }

    try {
      // 1. Get user's active or trialing subscription
      const [subscription] = await db
        .select()
        .from(usersSubscriptions)
        .where(
          and(
            eq(usersSubscriptions.userId, userId)
            // Check for active or trialing status
            // Also include subscriptions that are still valid (not ended)
          )
        )
        .limit(1);

      if (!subscription) {
        throw new ApiError(
          403,
          "No active subscription found. Please subscribe to a plan to upload files."
        );
      }

      // 2. Check if subscription is in valid status
      const validStatuses = ["active", "trialing"];
      if (!validStatuses.includes(subscription.status)) {
        throw new ApiError(
          403,
          `Subscription is ${subscription.status}. Please activate your subscription to continue.`
        );
      }

      // 3. Determine the page limit based on subscription type
      let pageLimit;
      let pagesUsed;

      if (subscription.isTrial && subscription.status === "trialing") {
        // For trial subscriptions, use trial limits
        pageLimit = subscription.trialPagesLimit || 0;
        pagesUsed = subscription.trialPagesUsed || 0;

        // Check if trial has expired
        if (
          subscription.trialEndsAt &&
          new Date(subscription.trialEndsAt) < new Date()
        ) {
          throw new ApiError(
            403,
            "Your trial period has expired. Please upgrade to a paid plan to continue."
          );
        }
      } else {
        // For active subscriptions, check usage tracking
        pageLimit = subscription.maxPagesAllowed;

        // Get current billing period usage
        const now = new Date();
        const [usageTracking] = await db
          .select()
          .from(usersUsageTracking)
          .where(
            and(
              eq(usersUsageTracking.userId, userId),
              eq(usersUsageTracking.subscriptionId, subscription.id),
              lte(usersUsageTracking.periodStart, now),
              gte(usersUsageTracking.periodEnd, now)
            )
          )
          .limit(1);

        pagesUsed = usageTracking?.pagesIndexed || 0;

        // Add bonus pages if available
        const bonusPages = subscription.bonusPages || 0;
        pageLimit += bonusPages;
      }

      // 4. Check if user has exceeded page limit
      if (pagesUsed >= pageLimit) {
        throw new ApiError(
          403,
          `Page limit reached. You have used ${pagesUsed} out of ${pageLimit} pages allowed in your ${subscription.isTrial ? "trial" : "current billing period"}. Please upgrade your plan or wait for the next billing cycle.`
        );
      }

      // 5. Attach subscription info to request for later use
      req.subscription = {
        id: subscription.id,
        status: subscription.status,
        isTrial: subscription.isTrial,
        pageLimit,
        pagesUsed,
        pagesRemaining: pageLimit - pagesUsed,
      };

      // Proceed to next middleware/controller
      next();
    } catch (error) {
      // If it's already an ApiError, throw it as is
      if (error instanceof ApiError) {
        throw error;
      }
      // Otherwise, wrap it in a generic error
      console.error("Error checking subscription and page limit:", error);
      throw new ApiError(500, "Failed to verify subscription status");
    }
  }
);
