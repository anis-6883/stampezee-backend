import express from "express";
import { ROLE } from "../configs/constants";
import branchRoutes from "../features/manage-branch/routes";
import subAdminRoutes from "../features/manage-sub-admin//routes";
import { refreshAccessToken, verifyToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/verify-token", verifyToken);
router.use("/refresh-token", refreshAccessToken);
router.use("/retailer", retailerAuthRoutes);
router.use("/retailer/branch", authAndPermissionCheck(ROLE.RETAILER), branchRoutes);
router.use("/retailer/sub-admin", authAndPermissionCheck(ROLE.RETAILER), subAdminRoutes);

export default router;
