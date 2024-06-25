import express from "express";
import { ROLE } from "../configs/constants";
import categoryRoutes from "../features/category/route";
import faqRoutes from "../features/faq/route";
import manageRetailerRoutes from "../features/retailer/route";
import settingsRoutes from "../features/settings/route";
import sortingRoutes from "../features/sorting/route";
import stampImageRoutes from "../features/stamp-image/route";
import subscriptionRoutes from "../features/subscription/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);

router.use(authAndPermissionCheck(ROLE.SUPER_ADMIN));
router.use("/super-admin/sort", sortingRoutes);
router.use("/super-admin/settings", settingsRoutes);
router.use("/super-admin/category", categoryRoutes);
router.use("/super-admin/stamp-image", stampImageRoutes);
router.use("/super-admin/manage-retailer", manageRetailerRoutes);
router.use("/super-admin/subscription", subscriptionRoutes);
router.use("/super-admin/faq", faqRoutes);

export default router;
