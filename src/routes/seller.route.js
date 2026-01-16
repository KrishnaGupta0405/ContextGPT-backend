import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createSeller,
  getSellerProfile,
  updateSellerProfile,
  deleteSeller,
  getAllSellers,
  getSellerById,
  verifySellerAccount,
} from "../controllers/seller.controller.js";

const router = Router();

/**
 * Seller Registration & Profile Management
 */
// Create seller profile (user becomes a seller)
router.route("/register").post(verifyJWT, upload.none(), createSeller);

// Get current seller's profile
router.route("/profile").get(verifyJWT, getSellerProfile);

// Update seller profile
router.route("/profile").patch(verifyJWT, upload.none(), updateSellerProfile);

// Delete seller account
router.route("/profile").delete(verifyJWT, deleteSeller);

/**
 * Public Routes
 */
// Get all sellers (with pagination and filters)
router.route("/").get(getAllSellers);

// Get seller by ID
router.route("/:sellerId").get(getSellerById);

/**
 * Admin Routes
 */
// Verify seller account (admin only)
router.route("/:sellerId/verify").patch(verifyJWT, upload.none(), verifySellerAccount);

export default router;