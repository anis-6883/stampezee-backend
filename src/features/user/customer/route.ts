import express from "express";
import { tempCustomerAuthorize } from "../../../middlewares/authMiddleware";
import { customerLogin, customerOtpVerify, customerRegistration, customerResendOtp } from "./controller";

const router = express.Router();

router.post("/register", customerRegistration);
router.post("/otp-verify", tempCustomerAuthorize, customerOtpVerify);
router.get("/resend-otp", tempCustomerAuthorize, customerResendOtp);
router.post("/login", customerLogin);

export default router;
