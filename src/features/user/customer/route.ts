import express from "express";
import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
  customerAndSubAdminChangeForgetPassword,
  customerAndSubAdminForgetPasswordOtpVerify,
  customerAndSubAdminLogin,
  customerAndSubAdminProfile,
  customerForgetPasswordResendOtp,
  customerOtpVerify,
  customerRegistration,
  customerResendOtp,
  deleteAccount,
  forgetPassword,
  updateCustomerProfile,
  updateLocationDeviceToken,
} from "./controller";

const router = express.Router();

router.post("/login", customerAndSubAdminLogin);
router.post("/register", customerRegistration);
router.post("/forget-password", forgetPassword);

router.get("/profile", authAndPermissionCheck([ROLE.CUSTOMER, ROLE.SUB_ADMIN]), customerAndSubAdminProfile);
router.put("/profile", authAndPermissionCheck(ROLE.CUSTOMER), updateCustomerProfile);
router.put("/update-location-token", authAndPermissionCheck(ROLE.CUSTOMER), updateLocationDeviceToken);
router.delete("/request-delete", authAndPermissionCheck(ROLE.CUSTOMER), deleteAccount);

router.use(authAndPermissionCheck([ROLE.CUSTOMER, ROLE.SUB_ADMIN], true, true, true));
router.get("/resend-otp", customerResendOtp);
router.get("/resend-forget-password-otp", customerForgetPasswordResendOtp);
router.post("/forget-password-otp-verify", customerAndSubAdminForgetPasswordOtpVerify);
router.post("/change-forget-password", customerAndSubAdminChangeForgetPassword);
router.post("/otp-verify", customerOtpVerify);

export default router;
