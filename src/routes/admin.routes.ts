import express from "express";
import settingsRoutes from "../features/settings/route";
import sortingRoutes from "../features/sorting/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);
router.use("/super-admin/settings", settingsRoutes);
router.use("/super-admin/sort", sortingRoutes);

export default router;
