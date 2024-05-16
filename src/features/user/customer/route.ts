import express from "express";
import { authorizationCheck } from "../../../middlewares/authMiddleware";
import {
  customerLogin,
  customerOtpVerify,
  customerProfile,
  customerRegistration,
  customerResendOtp,
} from "./controller";

const router = express.Router();

router.post("/register", customerRegistration);
router.post("/otp-verify", authorizationCheck, customerOtpVerify);
router.get("/resend-otp", authorizationCheck, customerResendOtp);
router.post("/login", customerLogin);
router.get("/profile", authorizationCheck, customerProfile);

export default router;
