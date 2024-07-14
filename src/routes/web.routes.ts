import express from "express";
import { ROLE } from "../configs/constants";
import billingRoutes from "../features/billing/route";
import branchRoutes from "../features/branch/route";
import subscriptionRoutes from "../features/enroll-subscription/route";
import { getAllFaqsForWeb } from "../features/faq/controller";
import { getCommonSettings, getSecretSettings } from "../features/settings/controller";
import stampImageRoutes from "../features/stamp-image/route";
import stampRoutes from "../features/stamp/route";
import subAdminRoutes from "../features/sub-admin/route";
import { getUserProfile, refreshAccessToken, userLogout, verifyToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

// Common Routes
router.get("/faqs", getAllFaqsForWeb);
router.get("/get-common-settings", getCommonSettings);
router.get("/get-secret-settings", authAndPermissionCheck("", false, false), getSecretSettings);
router.get("/verify-token", authAndPermissionCheck("", false, false), verifyToken);
router.get("/refresh-token", authAndPermissionCheck("", false), refreshAccessToken);
router.get("/get-profile", authAndPermissionCheck("", false), getUserProfile);
router.post("/user-logout", authAndPermissionCheck("", false), userLogout);

// Subscription Routes
router.use("/subscription-plans", subscriptionRoutes);

// Retailer Auth Routes
router.use("/retailer", retailerAuthRoutes);

// Retailer Panel Feature Routes
router.use(authAndPermissionCheck(ROLE.RETAILER));
router.use("/retailer/stamp", stampRoutes);
router.use("/retailer/branch", branchRoutes);
router.use("/retailer/sub-admin", subAdminRoutes);
router.use("/retailer/stamp-image", stampImageRoutes);
router.use("/retailer/billing", billingRoutes);

export default router;
