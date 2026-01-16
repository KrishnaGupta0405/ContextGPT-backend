import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  initiatePayment,
  verifyPayment,
  getMyPayments,
  getSellerPayments,
  getSellerPaymentStats,
} from "../controllers/payment.controller.js";

const router = Router();

/**
 * =====================
 * PAYMENT ROUTES
 * =====================
 */

/**
 * Payment Processing
 */
// Start payment
router.route("/payments/initiate").post(verifyJWT, upload.none(), initiatePayment);

// Verify payment
router.route("/payments/verify").post(verifyJWT, upload.none(), verifyPayment);

/**
 * Payment History
 */
// Buyer payments
router.route("/payments/my-payments").get(verifyJWT, getMyPayments);

// Seller earnings
router.route("/payments/seller/payments").get(verifyJWT, getSellerPayments);

// Seller payment stats
router.route("/payments/seller/stats").get(verifyJWT, getSellerPaymentStats);

export default router;
