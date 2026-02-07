import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import express from "express";
import {
  createPaddleTransaction,
  handlePaddleWebhook,
  getCurrentSubscription,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getAvailablePlans,
  getTransactionHistory,
} from "../controllers/billing.controller.js";

const router = Router();

// ────────────────────────────────────────────────
//   Public Routes (No Authentication Required)
// ────────────────────────────────────────────────

// this route requires userID for every request,
// and also priceID of the product that need to be purchased
//  hence test this when the frontend is ready
if (process.env.NODE_ENV === "development") {
  router
    .route("/test/checkout/create")
    .post(upload.none(), async (req, res, next) => {
      // Mock user for testing
      req.user = {
        id: "e03c8360-1b8b-4798-9ebe-2f7c79eeb269",
      };
      return createPaddleTransaction(req, res, next);
    });
}

router.route("/plans").get(getAvailablePlans);

// Webhook endpoint - MUST use raw body for signature verification
router.route("/webhook/paddle").post(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  }),
  handlePaddleWebhook
);

// ────────────────────────────────────────────────
//   Protected Routes (Authentication Required)
// ────────────────────────────────────────────────

// Checkout & Subscription Management
router
  .route("/checkout/create")
  .post(verifyJWT, upload.none(), createPaddleTransaction);

router.route("/subscription/current").get(verifyJWT, getCurrentSubscription);

router
  .route("/subscription/cancel")
  .post(verifyJWT, upload.none(), cancelSubscription);

router
  .route("/subscription/pause")
  .post(verifyJWT, upload.none(), pauseSubscription);

router
  .route("/subscription/resume")
  .post(verifyJWT, upload.none(), resumeSubscription);

// Transaction History
router.route("/transactions").get(verifyJWT, getTransactionHistory);

export default router;
