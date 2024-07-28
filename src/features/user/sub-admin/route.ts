import express from "express";

import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  subAdminChangeForgetPassword,
  subAdminForgetPassword,
  subAdminForgetPasswordOtpVerify,
  subAdminForgetPasswordResendOtp,
  subAdminLogin,
  subAdminProfile,
} from "./controller";

const router = express.Router();

router.post("/login", subAdminLogin);
router.post("/forget-password", subAdminForgetPassword);

router.get("/profile", authAndPermissionCheck(ROLE.SUB_ADMIN), subAdminProfile);

router.use(authAndPermissionCheck(ROLE.SUB_ADMIN, true, true, true));
router.get("/resend-forget-password-otp", subAdminForgetPasswordResendOtp);
router.post("/forget-password-otp-verify", subAdminForgetPasswordOtpVerify);
router.post("/change-forget-password", subAdminChangeForgetPassword);

export default router;
