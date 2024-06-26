import express from "express";
import multer from "multer";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  retailerChangeForgetPassword,
  retailerChangePassword,
  retailerForgetPassword,
  retailerForgetPasswordOtpVerify,
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

router.use(authAndPermissionCheck(ROLE.RETAILER));
router.post("/otp-verify", retailerOtpVerify);
router.post("/forget-password-otp-verify", retailerForgetPasswordOtpVerify);
router.post("/change-forget-password", retailerChangeForgetPassword);
router.post("/change-password", retailerChangePassword);
router.post("/resend-otp", retailerResendOtp);
router.get("/profile", retailerProfile);
router.put("/profile", upload.single("image"), updateRetailerProfile);

export default router;
