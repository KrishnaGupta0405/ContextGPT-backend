import { Router } from "express";
import {
  generateReferralCode,
  applyReferralCode,
  listMyReferrals,
  getReferralStats,
} from "../controllers/referral.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(verifyJWT);

// Referral management routes
router.route("/generate").post(generateReferralCode);
router.route("/apply").post(applyReferralCode);
router.route("/my-referrals").get(listMyReferrals);
router.route("/stats").get(getReferralStats);

export default router;
