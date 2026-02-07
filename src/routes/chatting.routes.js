import { Router } from "express";
import {
  handleChatQuery,
  handleChatFeedback,
} from "../controllers/chatting.controller.js";

const router = Router();

// ============================================
// PUBLIC CHAT ROUTES (No Authentication)
// These endpoints are called from embedded widgets
// ============================================

// Main chat query endpoint
router.post("/query", handleChatQuery);

// Feedback endpoint
router.post("/feedback", handleChatFeedback);

export default router;
