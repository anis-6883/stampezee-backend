import express from "express";
import multer from "multer";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  retailerChangeForgetPassword,
  retailerChangePassword,
  retailerForgetPassword,
  retailerForgetPasswordOtpVerify,
  retailerForgetPasswordResendOtp,
  retailerLogin,
  retailerLogout,
  retailerOtpVerify,
  retailerProfile,
  retailerRegistration,
  retailerResendOtp,
  updateRetailerProfile,
} from "./controller";

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const router = express.Router();

router.post("/login", retailerLogin);
router.post("/logout", retailerLogout);
router.post("/register", retailerRegistration);
router.post("/forget-password", retailerForgetPassword);

router.get("/profile", authAndPermissionCheck(ROLE.RETAILER), retailerProfile);
router.put("/profile", authAndPermissionCheck(ROLE.RETAILER), upload.single("image"), updateRetailerProfile);
router.post("/change-password", authAndPermissionCheck(ROLE.RETAILER), retailerChangePassword);

router.post("/otp-verify", authAndPermissionCheck(ROLE.RETAILER, true, true, true), retailerOtpVerify);
router.post("/resend-otp", authAndPermissionCheck(ROLE.RETAILER, true, true, true), retailerResendOtp);
router.post(
  "/forget-password-otp-verify",
  authAndPermissionCheck(ROLE.RETAILER, true, true, true),
  retailerForgetPasswordOtpVerify
);
router.post(
  "/change-forget-password",
  authAndPermissionCheck(ROLE.RETAILER, true, true, true),
  retailerChangeForgetPassword
);
router.post(
  "/resend-forget-password-otp",
  authAndPermissionCheck(ROLE.RETAILER, true, true, true),
  retailerForgetPasswordResendOtp
);

export default router;
