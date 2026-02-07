import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getAllSessions,
  revokeSession,
} from "../controllers/user.auth.controller.js";

const router = Router();

// ────────────────────────────────────────────────
//   Public Routes (No Authentication Required)
// ────────────────────────────────────────────────

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(upload.none(), loginUser);

router.route("/refresh-token").post(upload.none(), refreshAccessToken);

// ────────────────────────────────────────────────
//   Protected Routes (Authentication Required)
// ────────────────────────────────────────────────

router.route("/logout").post(verifyJWT, upload.none(), logoutUser);

router
  .route("/change-password")
  .post(verifyJWT, upload.none(), changeCurrentPassword);

router.route("/sessions").get(verifyJWT, getAllSessions);

router
  .route("/revoke-session/:id")
  .post(verifyJWT, upload.none(), revokeSession);

export default router;
