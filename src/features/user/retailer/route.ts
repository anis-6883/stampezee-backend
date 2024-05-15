import express from "express";
import { tempRetailerAuthorize } from "../../../middlewares/authMiddleware";
import { retailerLogin, retailerOtpVerify, retailerRegistration, retailerResendOtp } from "./controller";

const router = express.Router();

router.post("/retailer/register", retailerRegistration);
router.post("/retailer/otp-verify", tempRetailerAuthorize, retailerOtpVerify);
router.get("/retailer/resend-otp", tempRetailerAuthorize, retailerResendOtp);
router.post("/retailer/login", retailerLogin);

export default router;
