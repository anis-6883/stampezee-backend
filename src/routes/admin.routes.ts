import express from "express";
import settingsRoutes from "../features/settings/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);
router.use("/super-admin/settings", settingsRoutes);

export default router;
