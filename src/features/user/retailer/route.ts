import express from "express";
import multer from "multer";

import { ROLE } from "../../../configs/constants";
import { authAndPermissionCheck } from "../../../middlewares/authMiddleware";
import {
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

router.post("/register", retailerRegistration);
router.post("/otp-verify", authAndPermissionCheck(ROLE.RETAILER), retailerOtpVerify);
router.post("/resend-otp", authAndPermissionCheck(ROLE.RETAILER), retailerResendOtp);
router.post("/login", retailerLogin);
router.post("/logout", retailerLogout);
router.get("/profile", authAndPermissionCheck(ROLE.RETAILER), retailerProfile);
router.put("/profile", authAndPermissionCheck(ROLE.RETAILER), upload.single("image"), updateRetailerProfile);

export default router;
