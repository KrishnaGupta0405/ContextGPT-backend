import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  getUserChannelProfile,
} from "../controllers/user.controller.js";

const router = Router();

// Register
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  registerUser
);

/**
 * Auth
 */
router.route("/login").post(upload.none(), loginUser);
router.route("/logout").post(verifyJWT, upload.none(), logoutUser);
router.route("/refresh-token").post(upload.none(), refreshAccessToken);

/**
 * User account
 */
router
  .route("/change-password")
  .post(verifyJWT, upload.none(), changeCurrentPassword);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router
  .route("/update-account")
  .patch(verifyJWT, upload.none(), updateAccountDetails);

/**
 * Media
 */
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);

/**
 * Public profile
 */
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);

export default router;
