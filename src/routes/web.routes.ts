import express from "express";
import { ROLE } from "../configs/constants";
import branchRoutes from "../features/branch/route";
import subscriptionRoutes from "../features/enroll-subscription/route";
import stampImageRoutes from "../features/stamp-image/route";
import stampRoutes from "../features/stamp/route";
import subAdminRoutes from "../features/sub-admin/route";
import { getUserProfile, refreshAccessToken, userLogout, verifyToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

// Common Routes
router.get("/verify-token", authAndPermissionCheck("", false, false), verifyToken);
router.get("/refresh-token", authAndPermissionCheck("", false), refreshAccessToken);
router.get("/get-profile", authAndPermissionCheck("", false), getUserProfile);
router.post("/user-logout", authAndPermissionCheck("", false), userLogout);

// Subscription Routes
router.use("/enroll-subscriptions", subscriptionRoutes);

// Retailer Panel Feature Routes
router.use("/retailer", retailerAuthRoutes);
router.use("/retailer/branch", authAndPermissionCheck(ROLE.RETAILER), branchRoutes);
router.use("/retailer/sub-admin", authAndPermissionCheck(ROLE.RETAILER), subAdminRoutes);
router.use("/retailer/stamp-image", authAndPermissionCheck(ROLE.RETAILER), stampImageRoutes);
router.use("/retailer/stamp", authAndPermissionCheck(ROLE.RETAILER), stampRoutes);

export default router;
