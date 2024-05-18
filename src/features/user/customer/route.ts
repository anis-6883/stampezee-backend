import express from "express";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  customerLogin,
  customerOtpVerify,
  customerProfile,
  customerRegistration,
  customerResendOtp,
} from "./controller";

const router = express.Router();

router.post("/register", customerRegistration);
router.post("/otp-verify", authAndPermissionCheck(ROLE.CUSTOMER), customerOtpVerify);
router.get("/resend-otp", authAndPermissionCheck(ROLE.CUSTOMER), customerResendOtp);
router.post("/login", customerLogin);
router.get("/profile", authAndPermissionCheck(ROLE.CUSTOMER), customerProfile);

export default router;
