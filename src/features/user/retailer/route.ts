import express from "express";
import { tempRetailerAuthorize } from "../../../middlewares/authMiddleware";
import { retailerLogin, retailerOtpVerify, retailerRegistration, retailerResendOtp } from "./controller";

const router = express.Router();

router.post("/register", retailerRegistration);
router.post("/otp-verify", tempRetailerAuthorize, retailerOtpVerify);
router.get("/resend-otp", tempRetailerAuthorize, retailerResendOtp);
router.post("/login", retailerLogin);

export default router;
