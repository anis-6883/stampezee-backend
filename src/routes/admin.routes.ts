import express from "express";
import { ROLE } from "../configs/constants";
import categoryRoutes from "../features/manage-category/route";
import settingsRoutes from "../features/settings/route";
import sortingRoutes from "../features/sorting/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);
router.use("/super-admin/settings", settingsRoutes);
router.use("/super-admin/sort", authAndPermissionCheck(ROLE.SUPER_ADMIN), sortingRoutes);
router.use("/super-admin/category", authAndPermissionCheck(ROLE.SUPER_ADMIN), categoryRoutes);

export default router;
