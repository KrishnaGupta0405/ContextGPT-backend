import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { db } from "../index.js";
import { eq, sql, and, desc } from "drizzle-orm";
import { paddle } from "../app.js";
import crypto from "crypto";

// Import schema tables from drizzle
import {
  users,
  usersSubscriptions,
  websiteSubscriptions,
  websiteAddOns,
  paddleWebhookEvents,
  paddleTransactions,
} from "../../drizzle/schema.ts";

// Import referral controller functions
import {
  validatePromoCode,
  processPromotionReward,
} from "./referral.controller.js";

// ────────────────────────────────────────────────
//   Helper Functions
// ────────────────────────────────────────────────

/**
 * Verify Paddle webhook signature
 * Paddle sends signature in format: "ts=timestamp;h1=signature"
 */
const verifyPaddleWebhook = (rawBody, paddleSignature) => {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("PADDLE_WEBHOOK_SECRET not configured");
  }

  if (!paddleSignature) {
    return false;
  }

  try {
    // Parse the signature header: "ts=timestamp;h1=signature"
    const parts = paddleSignature.split(";");
    const timestamp = parts[0].split("=")[1];
    const signature = parts[1].split("=")[1];

    // Create the signed payload: timestamp:rawBody
    const signedPayload = `${timestamp}:${rawBody}`;

    // Compute HMAC SHA256
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(signedPayload)
      .digest("hex");

    // Compare signatures
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("Paddle webhook verification failed:", error.message);
    return false;
  }
};

/**
 * Extract user ID from Paddle customer metadata
 */
const getUserIdFromCustomer = async (paddleCustomerId) => {
  // First try to find existing subscription with this customer
  const [subscription] = await db
    .select({ userId: usersSubscriptions.userId })
    .from(usersSubscriptions)
    .where(eq(usersSubscriptions.paddleCustomerId, paddleCustomerId))
    .limit(1);

  if (subscription) {
    return subscription.userId;
  }

  // If not found, fetch customer from Paddle to get metadata
  try {
    const customer = await paddle.customers.get(paddleCustomerId);
    return customer.customData?.userId || null;
  } catch (error) {
    console.error("Failed to fetch customer from Paddle:", error);
    return null;
  }
};

export async function getInvalidPriceIds(priceIds) {
  // Handle empty or invalid input
  if (!priceIds || !Array.isArray(priceIds) || priceIds.length === 0) {
    return [];
  }

  // Remove duplicates to make query more efficient
  const uniquePriceIds = [...new Set(priceIds)];

  // Fetch valid price IDs from subscriptions using inArray
  const subscriptionPrices = await db
    .select({ paddlePriceId: websiteSubscriptions.paddlePriceId })
    .from(websiteSubscriptions)
    .where(
      sql`${websiteSubscriptions.paddlePriceId} IN (${sql.join(
        uniquePriceIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  // Fetch valid price IDs from add-ons using inArray
  const addonPrices = await db
    .select({ paddlePriceId: websiteAddOns.paddlePriceId })
    .from(websiteAddOns)
    .where(
      sql`${websiteAddOns.paddlePriceId} IN (${sql.join(
        uniquePriceIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    );

  // Combine all found valid price IDs into a Set for fast lookup
  const validPriceIds = new Set([
    ...subscriptionPrices.map((row) => row.paddlePriceId),
    ...addonPrices.map((row) => row.paddlePriceId),
  ]);

  // Return only the price IDs that were NOT found
  const invalidPriceIds = uniquePriceIds.filter((id) => !validPriceIds.has(id));

  return invalidPriceIds;
}

// ────────────────────────────────────────────────
//   Core Billing Controllers
// ────────────────────────────────────────────────

/**
 * 1. Create Paddle Transaction (Checkout)
 * Generate Paddle transaction for subscription purchase
 */

// PriceID -> Subscription or Addon
// Frontned -> {
//   "items": [
//     { "priceId": "pri_main_pro_monthly" },
//     { "priceId": "pri_remove_branding" },
//     { "priceId": "pri_extra_5k_messages" }
//   ]
// }

// TODO : Single Subscription Constraint: Your code doesn't check if the user already has an active subscription.
// TODO :      You might want to add validation to prevent multiple subscriptions.
export const createPaddleTransaction = asyncHandler(async (req, res) => {
  const { items, promoCode } = req.body; // ← Added promoCode
  const userId = req.user.id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(
      400,
      "Items array with at least one priceId is required"
    );
  }

  // ✅ NEW: Validate promo code if provided
  if (promoCode) {
    try {
      await validatePromoCode(promoCode, userId);
    } catch (error) {
      throw new ApiError(400, error.message || "Invalid promo code");
    }
  }

  // Fetch user details
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // ── Validate all price IDs exist in our database ──
  // Each priceId must exist in either website_subscriptions or website_add_ons
  const priceIds = items.map((item) => item.priceId);

  const invalidPriceIds = await getInvalidPriceIds(priceIds);

  if (invalidPriceIds.length > 0) {
    throw new ApiError(
      400,
      `Invalid price ID(s): ${invalidPriceIds.join(", ")}. Price IDs must exist in either subscriptions or addons catalog.`
    );
  }

  try {
    // Create or get Paddle customer
    let paddleCustomerId;

    // Check if user already has a Paddle customer ID
    const [existingSubscription] = await db
      .select({ paddleCustomerId: usersSubscriptions.paddleCustomerId })
      .from(usersSubscriptions)
      .where(eq(usersSubscriptions.userId, userId))
      .limit(1);

    if (existingSubscription?.paddleCustomerId) {
      paddleCustomerId = existingSubscription.paddleCustomerId;
    } else {
      // Create new Paddle customer
      try {
        const paddleCustomer = await paddle.customers.create({
          email: user.email,
          name: user.name,
          customData: {
            userId: userId,
          },
        });
        paddleCustomerId = paddleCustomer.id;
      } catch (error) {
        // If customer already exists in Paddle, extract the customer ID from error
        if (error.code === "customer_already_exists") {
          // Extract customer ID from error message: "customer email conflicts with customer of id ctm_xxx"
          const match = error.detail.match(/ctm_[a-z0-9]+/);
          if (match) {
            paddleCustomerId = match[0];
            console.log(`Using existing Paddle customer: ${paddleCustomerId}`);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Note: We don't create a subscription record here.
      // The subscription will be created via webhook handlers
      // (handleSubscriptionCreated) after successful payment.
      // await db.insert(usersSubscriptions).values({
      //   userId: userId,
      //   paddleCustomerId: paddleCustomer.id,
      // });
    }

    // retrieve paddle price
    // const paddlePrice = await paddle.prices.get(priceId);

    // Create transaction (modern Paddle API)
    const transaction = await paddle.transactions.create({
      items: items.map((item) => ({
        price_id: item.priceId,
        quantity: item.quantity ?? 1,
      })),
      customer_id: paddleCustomerId,
      custom_data: {
        userId: userId,
        promoCode: promoCode || null, // ← Store promo code for webhook
      },
      currency_code: "USD",
      collection_mode: "automatic", // automatic for subscriptions
      // billing_details: {
      //   enable_checkout: true,
      // },
      // checkout: {
      //   url: `${process.env.FRONTEND_URL}/billing/success?transaction_id={transaction_id}`,
      // },
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          transactionId: transaction.id,
          checkoutUrl: transaction.checkout?.url || null,
          customerId: paddleCustomerId,
          status: transaction.status,
        },
        "Transaction created successfully"
      )
    );
  } catch (error) {
    console.error("Paddle transaction creation failed:", error);
    throw new ApiError(500, error.message || "Failed to create transaction");
  }
});

/**
 * 2. Handle Paddle Webhook
 * Process all Paddle webhook events
 */
export const handlePaddleWebhook = asyncHandler(async (req, res) => {
  const paddleSignature = req.headers["paddle-signature"];
  const rawBody = req.rawBody; // Raw body from express.raw() middleware

  if (!paddleSignature) {
    console.error("Missing Paddle signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  // Verify webhook signature using Paddle SDK
  if (!verifyPaddleWebhook(rawBody, paddleSignature)) {
    console.error("Invalid Paddle webhook signature");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const event = JSON.parse(rawBody);
  const eventId = event.event_id;
  const eventType = event.event_type;

  // Check if event already processed (idempotency)
  const [existingEvent] = await db
    .select()
    .from(paddleWebhookEvents)
    .where(eq(paddleWebhookEvents.eventId, eventId))
    .limit(1);

  if (existingEvent) {
    console.log(`Event ${eventId} already processed`);
    return res.status(200).json({ received: true });
  }

  // Store webhook event
  await db.insert(paddleWebhookEvents).values({
    eventId: eventId,
    eventType: eventType,
    paddleSubscriptionId: event.data?.subscription_id || null,
    paddleCustomerId: event.data?.customer_id || null,
    paddleTransactionId: event.data?.id || null,
    payload: event,
    processed: false,
  });

  try {
    // Process event based on type
    switch (eventType) {
      case "transaction.completed":
        await handleTransactionCompleted(event.data);
        break;

      case "transaction.payment_failed":
        await handleTransactionFailed(event.data);
        break;

      case "subscription.created":
        await handleSubscriptionCreated(event.data);
        break;

      case "subscription.activated":
        await handleSubscriptionActivated(event.data);
        break;

      case "subscription.updated":
        await handleSubscriptionUpdated(event.data);
        break;

      case "subscription.paused":
        await handleSubscriptionPaused(event.data);
        break;

      case "subscription.resumed":
        await handleSubscriptionResumed(event.data);
        break;

      case "subscription.trialing":
        await handleSubscriptionTrialing(event.data);
        break;

      case "subscription.canceled":
        await handleSubscriptionCanceled(event.data);
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    // Mark event as processed
    await db
      .update(paddleWebhookEvents)
      .set({
        processed: true,
        processedAt: new Date(),
      })
      .where(eq(paddleWebhookEvents.eventId, eventId));

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(`Error processing webhook ${eventId}:`, error);

    // Update event with error
    await db
      .update(paddleWebhookEvents)
      .set({
        errorMessage: error.message,
        retryCount: sql`${paddleWebhookEvents.retryCount} + 1`,
      })
      .where(eq(paddleWebhookEvents.eventId, eventId));

    // Still return 200 to prevent Paddle from retrying immediately
    return res.status(200).json({ received: true, error: error.message });
  }
});

// ────────────────────────────────────────────────
//   Webhook Event Handlers
// ────────────────────────────────────────────────

//Transaction Completed
async function handleTransactionCompleted(transaction) {
  const userId = await getUserIdFromCustomer(transaction.customer_id);

  if (!userId) {
    throw new Error(`User not found for customer ${transaction.customer_id}`);
  }

  // Store transaction (updated for Paddle Billing API v2)
  await db.insert(paddleTransactions).values({
    userId: userId,
    paddleTransactionId: transaction.id,
    paddleSubscriptionId: transaction.subscription_id || null,
    status: transaction.status,
    amount: parseFloat(transaction.details.totals.total) / 100, // Convert from cents
    currency: transaction.currency_code,
    billingPeriodStart: transaction.billing_period?.starts_at
      ? new Date(transaction.billing_period.starts_at)
      : null,
    billingPeriodEnd: transaction.billing_period?.ends_at
      ? new Date(transaction.billing_period.ends_at)
      : null,
    receiptUrl: transaction.checkout?.url || null,
    invoiceUrl: null, // Invoice URL comes separately via invoice.* events
    createdAt: new Date(transaction.created_at),
    updatedAt: new Date(transaction.updated_at),
  });

  // ✅ NEW: Process promotion rewards if promo code was used
  const promoCode = transaction.custom_data?.promoCode;
  if (promoCode && transaction.subscription_id) {
    try {
      await processPromotionReward(
        promoCode,
        userId,
        transaction.subscription_id,
        transaction.id
      );
      console.log(`Processed promotion reward for code: ${promoCode}`);
    } catch (error) {
      console.error(`Failed to process promotion reward: ${error.message}`);
      // Don't throw - we don't want to fail the transaction if bonus fails
    }
  }

  // If this is a subscription transaction, update subscription
  if (transaction.subscription_id) {
    await updateSubscriptionFromTransaction(transaction, userId);
  }
}

//Transaction Failed
async function handleTransactionFailed(transaction) {
  const userId = await getUserIdFromCustomer(transaction.customer_id);

  if (!userId) {
    console.error(`User not found for customer ${transaction.customer_id}`);
    return;
  }

  // Update subscription status if applicable
  if (transaction.subscription_id) {
    await db
      .update(usersSubscriptions)
      .set({
        status: "past_due",
        updatedAt: new Date(),
      })
      .where(
        eq(usersSubscriptions.paddleSubscriptionId, transaction.subscription_id)
      );
  }
  // Store the failed transaction also, for getAllTranscation controller
  await db.insert(paddleTransactions).values({
    userId: userId,
    paddleTransactionId: transaction.id,
    paddleSubscriptionId: transaction.subscription_id || null,
    status: transaction.status,
    amount: parseFloat(transaction.details.totals.total) / 100, // Convert from cents
    currency: transaction.currency_code,
    billingPeriodStart: transaction.billing_period?.starts_at
      ? new Date(transaction.billing_period.starts_at)
      : null,
    billingPeriodEnd: transaction.billing_period?.ends_at
      ? new Date(transaction.billing_period.ends_at)
      : null,
    receiptUrl: transaction.checkout?.url || null,
    invoiceUrl: null, // Invoice URL comes separately via invoice.* events
    createdAt: new Date(transaction.created_at),
    updatedAt: new Date(transaction.updated_at),
  });
}

//Subscription Created
async function handleSubscriptionCreated(subscription) {
  const userId = await getUserIdFromCustomer(subscription.customer_id);

  if (!userId) {
    throw new Error(`User not found for customer ${subscription.customer_id}`);
  }

  // Get plan details from your catalog
  const priceId = subscription.items[0]?.price.id;
  const [plan] = await db
    .select()
    .from(websiteSubscriptions)
    .where(eq(websiteSubscriptions.paddlePriceId, priceId))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found for price ${priceId}`);
  }

  // Create subscription record
  await db.insert(usersSubscriptions).values({
    userId: userId,
    subscriptionId: plan.id,

    paddleSubscriptionId: subscription.id,
    paddleCustomerId: subscription.customer_id,

    status: subscription.status,
    billingInterval: subscription.billing_cycle.interval,
    billingIntervalCount: subscription.billing_cycle.frequency,
    collectionMode: subscription.collection_mode,
    currentPeriodStart: new Date(subscription.current_billing_period.starts_at),
    currentPeriodEnd: new Date(subscription.current_billing_period.ends_at),
    nextBilledAt: subscription.next_billed_at
      ? new Date(subscription.next_billed_at)
      : null,

    scheduledChange: subscription.scheduled_change || null,

    maxChatbotsAllowed: plan.chatbotGiven,
    maxPagesAllowed: plan.pagesUpto,
    teamMemberAccess: plan.teamMemberAccess,
    apiAccess: plan.apiAccess,
    autoSyncData: plan.autoSyncData,
    webhookSupport: plan.webhookSupport,

    userMessageRateLimit: plan.userMessageRateLimit,

    currency: subscription.currency_code,
    totalPrice:
      parseFloat(subscription.items[0]?.price.unit_price.amount) / 100, // Convert from cents
    managementUrls: subscription.management_urls || null,
    bonusMessages: 0,
    bonusPages: 0,
  });
}

//Subscription Activated
async function handleSubscriptionActivated(subscription) {
  await db
    .update(usersSubscriptions)
    .set({
      status: "active",
      currentPeriodStart: new Date(
        subscription.current_billing_period.starts_at
      ),
      currentPeriodEnd: new Date(subscription.current_billing_period.ends_at),
      nextBilledAt: subscription.next_billed_at
        ? new Date(subscription.next_billed_at)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(usersSubscriptions.paddleSubscriptionId, subscription.id));
}

//Subscription Trialing
async function handleSubscriptionTrialing(subscription) {
  const userId = await getUserIdFromCustomer(subscription.customer_id);

  if (!userId) {
    throw new Error(`User not found for customer ${subscription.customer_id}`);
  }

  // Get plan details from your catalog
  const priceId = subscription.items[0]?.price.id;
  const [plan] = await db
    .select()
    .from(websiteSubscriptions)
    .where(eq(websiteSubscriptions.paddlePriceId, priceId))
    .limit(1);

  if (!plan) {
    throw new Error(`Plan not found for price ${priceId}`);
  }

  // Extract trial information from the first item
  const firstItem = subscription.items[0];
  const trialDates = firstItem?.trial_dates;

  // Create subscription record with trial tracking
  await db.insert(usersSubscriptions).values({
    userId: userId,
    subscriptionId: plan.id,

    paddleSubscriptionId: subscription.id,
    paddleCustomerId: subscription.customer_id,

    status: "trialing",
    billingInterval: subscription.billing_cycle.interval,
    billingIntervalCount: subscription.billing_cycle.frequency,
    collectionMode: subscription.collection_mode,
    currentPeriodStart: new Date(subscription.current_billing_period.starts_at),
    currentPeriodEnd: new Date(subscription.current_billing_period.ends_at),
    nextBilledAt: subscription.next_billed_at
      ? new Date(subscription.next_billed_at)
      : null,

    // Trial-specific fields
    isTrial: true,
    trialStartedAt: trialDates?.starts_at
      ? new Date(trialDates.starts_at)
      : null,
    trialEndsAt: trialDates?.ends_at ? new Date(trialDates.ends_at) : null,
    trialPagesUsed: 0,
    trialMessagesUsed: 0,
    trialChatbotsUsed: 0,
    trialPagesLimit: plan.trialPages || 0,
    trialMessagesLimit: plan.trialMessages || 0,
    trialChatbotsLimit: plan.trialChatbots || 0,

    scheduledChange: subscription.scheduled_change || null,

    maxChatbotsAllowed: plan.chatbotGiven,
    maxPagesAllowed: plan.pagesUpto,
    teamMemberAccess: plan.teamMemberAccess,
    apiAccess: plan.apiAccess,
    autoSyncData: plan.autoSyncData,
    webhookSupport: plan.webhookSupport,

    userMessageRateLimit: plan.userMessageRateLimit,

    currency: subscription.currency_code,
    totalPrice:
      parseFloat(subscription.items[0]?.price.unit_price.amount) / 100, // Convert from cents
    managementUrls: subscription.management_urls || null,
    bonusMessages: 0,
    bonusPages: 0,
  });
}

//Subscription Updated
async function handleSubscriptionUpdated(subscription) {
  await db
    .update(usersSubscriptions)
    .set({
      status: subscription.status,
      currentPeriodStart: new Date(
        subscription.current_billing_period.starts_at
      ),
      currentPeriodEnd: new Date(subscription.current_billing_period.ends_at),
      nextBilledAt: subscription.next_billed_at
        ? new Date(subscription.next_billed_at)
        : null,
      scheduledChange: subscription.scheduled_change || null,
      managementUrls: subscription.management_urls || null,
      updatedAt: new Date(),
    })
    .where(eq(usersSubscriptions.paddleSubscriptionId, subscription.id));
}

//Subscription Paused
async function handleSubscriptionPaused(subscription) {
  await db
    .update(usersSubscriptions)
    .set({
      status: "paused",
      pausedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(usersSubscriptions.paddleSubscriptionId, subscription.id));
}

//Subscription Resumed
async function handleSubscriptionResumed(subscription) {
  await db
    .update(usersSubscriptions)
    .set({
      status: "active",
      pausedAt: null,
      nextBilledAt: subscription.next_billed_at
        ? new Date(subscription.next_billed_at)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(usersSubscriptions.paddleSubscriptionId, subscription.id));
}

//Subscription Canceled
async function handleSubscriptionCanceled(subscription) {
  await db
    .update(usersSubscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
      endsAt: subscription.scheduled_change?.effective_at
        ? new Date(subscription.scheduled_change.effective_at)
        : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(usersSubscriptions.paddleSubscriptionId, subscription.id));
}

async function updateSubscriptionFromTransaction(transaction, userId) {
  const [subscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(
      and(
        eq(usersSubscriptions.userId, userId),
        eq(usersSubscriptions.paddleSubscriptionId, transaction.subscription_id)
      )
    )
    .limit(1);

  if (subscription) {
    await db
      .update(usersSubscriptions)
      .set({
        paddleTransactionId: transaction.id,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(usersSubscriptions.id, subscription.id));
  }
}

// ────────────────────────────────────────────────
//   Subscription Management Controllers
// ────────────────────────────────────────────────

/**
 * 3. Get Current Subscription
 * Get user's active subscription details
 */
export const getCurrentSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const [subscription] = await db
    .select({
      id: usersSubscriptions.id,
      paddleSubscriptionId: usersSubscriptions.paddleSubscriptionId,
      status: usersSubscriptions.status,
      billingInterval: usersSubscriptions.billingInterval,

      currentPeriodStart: usersSubscriptions.currentPeriodStart,
      currentPeriodEnd: usersSubscriptions.currentPeriodEnd,
      nextBilledAt: usersSubscriptions.nextBilledAt,
      cancelAtPeriodEnd: usersSubscriptions.cancelAtPeriodEnd,
      maxChatbotsAllowed: usersSubscriptions.maxChatbotsAllowed,
      maxPagesAllowed: usersSubscriptions.maxPagesAllowed,
      userMessageRateLimit: usersSubscriptions.userMessageRateLimit,
      bonusMessages: usersSubscriptions.bonusMessages,
      bonusPages: usersSubscriptions.bonusPages,
      currency: usersSubscriptions.currency,
      totalPrice: usersSubscriptions.totalPrice,
      managementUrls: usersSubscriptions.managementUrls,
      // Plan details
      planType: websiteSubscriptions.type,
      planPrice: websiteSubscriptions.price,
    })
    .from(usersSubscriptions)
    .innerJoin(
      websiteSubscriptions,
      eq(usersSubscriptions.subscriptionId, websiteSubscriptions.id)
    )
    .where(eq(usersSubscriptions.userId, userId))
    .limit(1);

  if (!subscription) {
    throw new ApiError(404, "No subscription found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        subscription,
        "Subscription details fetched successfully"
      )
    );
});

/**
 * 4. Cancel Subscription
 * Cancel subscription via Paddle API
 */
export const cancelSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { effectiveFrom = "next_billing_period" } = req.body;

  // Find active subscription
  const [subscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(
      and(
        eq(usersSubscriptions.userId, userId),
        eq(usersSubscriptions.status, "active")
      )
    )
    .limit(1);

  if (!subscription) {
    throw new ApiError(404, "No active subscription found");
  }

  try {
    // Cancel via Paddle API
    await paddle.subscriptions.cancel(subscription.paddleSubscriptionId, {
      effectiveFrom: effectiveFrom, // "immediately" or "next_billing_period"
    });

    // Update local record
    const updateData = {
      cancelAtPeriodEnd: effectiveFrom === "next_billing_period",
      updatedAt: new Date(),
    };

    if (effectiveFrom === "immediately") {
      updateData.status = "canceled";
      updateData.canceledAt = new Date();
      updateData.endsAt = new Date();
    }

    // Update local record
    await db
      .update(usersSubscriptions)
      .set(updateData)
      .where(eq(usersSubscriptions.id, subscription.id));

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          subscriptionId: subscription.paddleSubscriptionId,
          effectiveFrom: effectiveFrom,
        },
        "Subscription cancelled successfully"
      )
    );
  } catch (error) {
    console.error("Paddle cancellation failed:", error);
    throw new ApiError(500, error.message || "Failed to cancel subscription");
  }
});

/**
 * 5. Pause Subscription
 * Pause subscription via Paddle API
 */
export const pauseSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { effectiveFrom = "next_billing_period" } = req.body;

  const [subscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(
      and(
        eq(usersSubscriptions.userId, userId),
        eq(usersSubscriptions.status, "active")
      )
    )
    .limit(1);

  if (!subscription) {
    throw new ApiError(404, "No active subscription found");
  }

  try {
    await paddle.subscriptions.pause(subscription.paddleSubscriptionId, {
      effectiveFrom: effectiveFrom,
    });

    //update local record
    const updateData = {
      status: "paused",
      updatedAt: new Date(),
    };
    await db
      .update(usersSubscriptions)
      .set(updateData)
      .where(eq(usersSubscriptions.id, subscription.id));

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Subscription paused successfully"));
  } catch (error) {
    console.error("Paddle pause failed:", error);
    throw new ApiError(500, error.message || "Failed to pause subscription");
  }
});

/**
 * 6. Resume Subscription
 * Resume paused subscription via Paddle API
 */
export const resumeSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { effectiveFrom = "immediately" } = req.body;

  const [subscription] = await db
    .select()
    .from(usersSubscriptions)
    .where(
      and(
        eq(usersSubscriptions.userId, userId),
        eq(usersSubscriptions.status, "paused")
      )
    )
    .limit(1);

  if (!subscription) {
    throw new ApiError(404, "No paused subscription found");
  }

  try {
    await paddle.subscriptions.resume(subscription.paddleSubscriptionId, {
      effectiveFrom: effectiveFrom,
    });

    //update local record
    const updateData = {
      status: "active",
      updatedAt: new Date(),
    };
    await db
      .update(usersSubscriptions)
      .set(updateData)
      .where(eq(usersSubscriptions.id, subscription.id));

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Subscription resumed successfully"));
  } catch (error) {
    console.error("Paddle resume failed:", error);
    throw new ApiError(500, error.message || "Failed to resume subscription");
  }
});

/**
 * 7. Get Available Plans
 * List all subscription plans
 */
export const getAvailablePlans = asyncHandler(async (req, res) => {
  const plans = await db.select().from(websiteSubscriptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        plans,
        total: plans.length,
      },
      "Subscription plans fetched successfully"
    )
  );
});

/**
 * 8. Get Transaction History
 * Fetch all transactions for user
 */
export const getTransactionHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { limit = 10, offset = 0 } = req.query;

  const transactions = await db
    .select()
    .from(paddleTransactions)
    .where(eq(paddleTransactions.userId, userId))
    .orderBy(desc(paddleTransactions.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        transactions,
        total: transactions.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
      "Transaction history fetched successfully"
    )
  );
});
