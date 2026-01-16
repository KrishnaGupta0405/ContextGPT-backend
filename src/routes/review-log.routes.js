import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createReview,
  getAgentReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  getReviewById,
} from "../controllers/review.controller.js";
import {
  getAgentLogs,
  getLogById,
  createLog,
  clearOldLogs,
} from "../controllers/log.controller.js";

const router = Router();

/**
 * =====================
 * REVIEW ROUTES
 * =====================
 */

/**
 * Review Management
 */
// Create review for an agent (buyer only, must have purchased)
router.route("/reviews").post(verifyJWT, upload.none(), createReview);

// Get all reviews by current user
router.route("/reviews/my-reviews").get(verifyJWT, getMyReviews);

// Get single review
router.route("/reviews/:reviewId").get(getReviewById);

// Update review
router.route("/reviews/:reviewId").patch(verifyJWT, upload.none(), updateReview);

// Delete review
router.route("/reviews/:reviewId").delete(verifyJWT, deleteReview);

/**
 * Public Routes
 */
// Get all reviews for a specific agent
router.route("/agents/:agentId/reviews").get(getAgentReviews);

/**
 * =====================
 * LOG ROUTES
 * =====================
 */

/**
 * Agent Logs (for monitoring agent instances)
 */
// Get logs for a specific agent instance
router.route("/logs/instance/:instanceId").get(verifyJWT, getAgentLogs);

// Get single log entry
router.route("/logs/:logId").get(verifyJWT, getLogById);

// Create log entry (system/agent generates logs)
router.route("/logs").post(verifyJWT, upload.none(), createLog);

// Clear old logs (maintenance/admin)
router.route("/logs/cleanup").delete(verifyJWT, clearOldLogs);

export default router;