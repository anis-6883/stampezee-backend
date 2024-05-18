import express from "express";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
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
router.post("/otp-verify", authAndPermissionCheck(ROLE.RETAILER), retailerOtpVerify);
router.get("/resend-otp", authAndPermissionCheck(ROLE.RETAILER), retailerResendOtp);
router.post("/login", retailerLogin);
router.post("/logout", retailerLogout);
router.get("/profile", authAndPermissionCheck(ROLE.RETAILER), retailerProfile);

export default router;
