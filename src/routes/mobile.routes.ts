import express from "express";
import { ROLE } from "../configs/constants";
import searchPageRoutes from "../features/mobile/search/route";
import customerAuthRoutes from "../features/user/customer/route";
import subAdminAuthRoutes from "../features/user/sub-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/customer", customerAuthRoutes);
router.use("/stamp", authAndPermissionCheck(ROLE.CUSTOMER), searchPageRoutes);
router.use("/sub-admin", subAdminAuthRoutes);

export default router;
