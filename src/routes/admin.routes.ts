import express from "express";
import { ROLE } from "../configs/constants";
import categoryRoutes from "../features/category/route";
import manageRetailerRoutes from "../features/retailer/route";
import settingsRoutes from "../features/settings/route";
import sortingRoutes from "../features/sorting/route";
import stampImageRoutes from "../features/stamp-image/route";
import subscriptionRoutes from "../features/subscription/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);
router.use("/super-admin/settings", authAndPermissionCheck(ROLE.SUPER_ADMIN), settingsRoutes);
router.use("/super-admin/sort", authAndPermissionCheck(ROLE.SUPER_ADMIN), sortingRoutes);
router.use("/super-admin/category", authAndPermissionCheck(ROLE.SUPER_ADMIN), categoryRoutes);
router.use("/super-admin/stamp-image", authAndPermissionCheck(ROLE.SUPER_ADMIN), stampImageRoutes);
router.use("/super-admin/manage-retailer", authAndPermissionCheck(ROLE.SUPER_ADMIN), manageRetailerRoutes);
router.use("/super-admin/subscription", authAndPermissionCheck(ROLE.SUPER_ADMIN), subscriptionRoutes);

export default router;
