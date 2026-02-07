import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
} from "../controllers/user.controller.js";

const router = Router();

router
  .route("/update-account")
  .patch(verifyJWT, upload.none(), updateAccountDetails);
router
  .route("/avatar")
  .patch(verifyJWT, upload.single("avatar"), updateUserAvatar);
router.route("/current-user").get(verifyJWT, getCurrentUser);

export default router;

// at the frontend ---> https://app.com/register?invite=abc123
// const params = new URLSearchParams(window.location.search);
// const inviteToken = params.get("invite");
// if (inviteToken) {
//   call register-with-invite api
// } else {
//   call register api
// }
