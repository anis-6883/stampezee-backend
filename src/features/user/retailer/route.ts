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

router.post("/login", retailerLogin);
router.post("/logout", retailerLogout);
router.post("/register", retailerRegistration);

router.use(authAndPermissionCheck(ROLE.RETAILER));
router.post("/otp-verify", retailerOtpVerify);
router.post("/resend-otp", retailerResendOtp);
router.get("/profile", retailerProfile);
router.put("/profile", upload.single("image"), updateRetailerProfile);

export default router;
