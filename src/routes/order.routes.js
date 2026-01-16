import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createOrder,
  getMyOrders,
  getSellerOrders,
  cancelOrder,
  renewOrder,
} from "../controllers/order.controller.js";

const router = Router();

/**
 * =====================
 * ORDER ROUTES
 * =====================
 */

/**
 * Order Creation & Management
 */
// Create order (buy/rent)
router.route("/orders").post(verifyJWT, upload.none(), createOrder);

// Buyer's orders
router.route("/orders/my-orders").get(verifyJWT, getMyOrders);

// Seller's orders
router.route("/orders/seller/orders").get(verifyJWT, getSellerOrders);

// Cancel order
router.route("/orders/:orderId/cancel").patch(verifyJWT, cancelOrder);

// Renew subscription
router.route("/orders/:orderId/renew").post(verifyJWT, renewOrder);

export default router;
