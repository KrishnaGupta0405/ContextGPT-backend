import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createAgent,
  getMyAgents,
  updateAgent,
  getAllAgents,
  searchAgents,
} from "../controllers/agent.controller.js";

const router = Router();

/**
 * =====================
 * AGENT ROUTES
 * =====================
 */

/**
 * Seller Agent Management
 */
// Create automation agent
router.route("/agents").post(verifyJWT, upload.none(), createAgent);

// Get seller's agents
router.route("/agents/my-agents").get(verifyJWT, getMyAgents);

// Update agent
router.route("/agents/:agentId").patch(verifyJWT, upload.none(), updateAgent);

/**
 * Public Routes
 */
// Browse all agents
router.route("/agents").get(getAllAgents);

// Search agents
router.route("/agents/search").get(searchAgents);

export default router;
