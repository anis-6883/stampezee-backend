import express from "express";
import { ROLE } from "../configs/constants";
import homeScreenRoutes from "../features/mobile/home/route";
import searchScreenRoutes from "../features/mobile/search/route";
import customerAuthRoutes from "../features/user/customer/route";
import subAdminAuthRoutes from "../features/user/sub-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/auth-screen/sub-admin", subAdminAuthRoutes);
router.use("/auth-screen/customer", customerAuthRoutes);

router.use(authAndPermissionCheck(ROLE.CUSTOMER));
router.use("/home-screen", homeScreenRoutes);
router.use("/search-screen", searchScreenRoutes);

export default router;
