import { Router } from "express";
import {
  getWidgetConfig,
  updateWidgetConfig,
  trackWidgetSession,
  getWidgetAnalytics,
  serveWidgetScript,
} from "../controllers/widget.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// ============================================
// PUBLIC WIDGET ROUTES (No Authentication)
// ============================================

// Get widget configuration (public - for widget initialization)
router.get("/:chatbotId/config", verifyJWT, getWidgetConfig);

// Serve widget JavaScript file (public)
router.get("/:chatbotId/script.js", verifyJWT, serveWidgetScript);

// Track widget session (public)
router.post("/:chatbotId/track", verifyJWT, trackWidgetSession);

// ============================================
// AUTHENTICATED WIDGET MANAGEMENT ROUTES
// ============================================

// Update widget configuration (requires authentication)
router.put(
  "/account/:accountId/chatbot/:chatbotId/config",
  verifyJWT,
  updateWidgetConfig
);

// Get widget analytics (requires authentication)
router.get(
  "/account/:accountId/chatbot/:chatbotId/analytics",
  verifyJWT,
  getWidgetAnalytics
);

export default router;
