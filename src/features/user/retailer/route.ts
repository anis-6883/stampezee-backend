import express from "express";
import { authorizationCheck } from "../../../middlewares/authMiddleware";
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
router.post("/otp-verify", authorizationCheck, retailerOtpVerify);
router.get("/resend-otp", authorizationCheck, retailerResendOtp);
router.post("/login", retailerLogin);
router.post("/logout", retailerLogout);
router.get("/profile", authorizationCheck, retailerProfile);

export default router;
