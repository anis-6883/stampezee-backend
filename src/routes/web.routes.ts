import express from "express";
import { ROLE } from "../configs/constants";
import branchRoutes from "../features/manage-branch/routes";
import { refreshAccessToken, verifyToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/verify-token", verifyToken);
router.use("/refresh-token", refreshAccessToken);
router.use("/retailer", retailerAuthRoutes);
router.use("/retailer/branch", authAndPermissionCheck(ROLE.RETAILER), branchRoutes);

export default router;
