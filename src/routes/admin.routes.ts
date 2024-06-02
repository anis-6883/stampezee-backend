import express from "express";
import { ROLE } from "../configs/constants";
import categoryRoutes from "../features/manage-category/route";
import manageRetailerRoutes from "../features/manage-retailer/route";
import stampImageRoutes from "../features/manage-stamp-image/route";
import settingsRoutes from "../features/settings/route";
import sortingRoutes from "../features/sorting/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);
router.use("/super-admin/settings", settingsRoutes);
router.use("/super-admin/sort", authAndPermissionCheck(ROLE.SUPER_ADMIN), sortingRoutes);
router.use("/super-admin/category", authAndPermissionCheck(ROLE.SUPER_ADMIN), categoryRoutes);
router.use("/super-admin/stamp-image", authAndPermissionCheck(ROLE.SUPER_ADMIN), stampImageRoutes);
router.use("/super-admin/manage-retailer", authAndPermissionCheck(ROLE.SUPER_ADMIN), manageRetailerRoutes);

export default router;
