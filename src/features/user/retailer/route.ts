import express from "express";
import { retailerAuthorize } from "../../../middlewares/authMiddleware";
import {
  retailerLogin,
  retailerLogout,
  retailerOtpVerify,
  retailerProfile,
  retailerRegistration,
  retailerResendOtp,
} from "./controller";

const router = express.Router();

router.post("/register", retailerRegistration);
router.post("/otp-verify", retailerAuthorize, retailerOtpVerify);
router.get("/resend-otp", retailerAuthorize, retailerResendOtp);
router.post("/login", retailerLogin);
router.post("/logout", retailerLogout);
router.get("/profile", retailerAuthorize, retailerProfile);

export default router;
