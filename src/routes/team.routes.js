import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  registerUserWithInvite,
  acceptInvitation,
  sendTeamInvitation,
  getUserInvitations,
  resendInvitation,
  revokeInvitation,
  getAccountMembers,
  updateAccountMemberRole,
  removeAccountMember,
} from "../controllers/team.controller.js";

const router = Router();

// ────────────────────────────────────────────────
//   Public Routes (No Authentication Required)
// ────────────────────────────────────────────────

router.route("/invitations/register-with-invite").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  registerUserWithInvite
);

// ────────────────────────────────────────────────
//   Protected Routes (Authentication Required)
// ────────────────────────────────────────────────

// Invitation Management
router
  .route("/invitations/accept-invitation")
  .post(verifyJWT, upload.none(), acceptInvitation);

router
  .route("/invitations/send-invitation")
  .post(verifyJWT, upload.none(), sendTeamInvitation);

router
  .route("/invitations/get-all-invitations")
  .get(verifyJWT, getUserInvitations);

router
  .route("/invitations/:invitationId/resend")
  .post(verifyJWT, upload.none(), resendInvitation);

router
  .route("/invitations/:invitationId/revoke")
  .delete(verifyJWT, revokeInvitation);

// Account Member Management
router
  .route("/accounts/:accountId/members/get-all-members")
  .get(verifyJWT, getAccountMembers);

router
  .route("/accounts/:accountId/members/:userId/update-role")
  .patch(verifyJWT, upload.none(), updateAccountMemberRole);

router
  .route("/accounts/:accountId/members/:userId/remove-member")
  .delete(verifyJWT, removeAccountMember);

export default router;
