import express from "express";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  customerChangeForgetPassword,
  customerForgetPassword,
  customerForgetPasswordOtpVerify,
  customerForgetPasswordResendOtp,
  customerLogin,
  customerOtpVerify,
  customerProfile,
  customerRegistration,
  customerResendOtp,
  updateCustomerProfile,
  updateLocationDeviceToken,
} from "./controller";

const router = express.Router();

router.post("/login", customerLogin);
router.post("/register", customerRegistration);
router.post("/forget-password", customerForgetPassword);

router.use(authAndPermissionCheck(ROLE.CUSTOMER));
router.get("/resend-otp", customerResendOtp);
router.get("/resend-forget-password-otp", customerForgetPasswordResendOtp);
router.post("/forget-password-otp-verify", customerForgetPasswordOtpVerify);
router.post("/change-forget-password", customerChangeForgetPassword);
router.post("/otp-verify", customerOtpVerify);
router.get("/profile", customerProfile);
router.put("/profile", updateCustomerProfile);
router.put("/update-location-token", updateLocationDeviceToken);

export default router;
