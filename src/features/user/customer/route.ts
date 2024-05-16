import express from "express";
import { customerAuthorize } from "../../../middlewares/authMiddleware";
import {
  customerLogin,
  customerOtpVerify,
  customerProfile,
  customerRegistration,
  customerResendOtp,
} from "./controller";

const router = express.Router();

router.post("/register", customerRegistration);
router.post("/otp-verify", customerAuthorize, customerOtpVerify);
router.get("/resend-otp", customerAuthorize, customerResendOtp);
router.post("/login", customerLogin);
router.get("/profile", customerAuthorize, customerProfile);

export default router;
