import { Router } from "express";
import {
  getUsage,
  getModelsUsage,
  getUsageByPeriod,
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  getApiLogs,
} from "../controllers/usage.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Usage tracking routes
router.route("/").get(getUsage);
router.route("/models").get(getModelsUsage);
// TODO: add route to get model-usage of specific model also

router.route("/period/:startDate").get(getUsageByPeriod);

// API Key management routes
router.route("/api-keys/generate").post(generateApiKey);
router.route("/api-keys/get-all-api-keys").get(listApiKeys);
router.route("/api-keys/:keyId/revoke").delete(revokeApiKey);
router.route("/api-keys/get-api-logs").get(getApiLogs);

export default router;
