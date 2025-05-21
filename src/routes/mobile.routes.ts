import express from "express";
import { ROLE } from "../configs/constants";
import homeScreenCustomerRoutes from "../features/mobile/customer/home/route";
import notificationScreenCustomerRoutes from "../features/mobile/customer/notification/route";
import profileScreenCustomerRoutes from "../features/mobile/customer/profile/route";
import rewardScreenCustomerRoutes from "../features/mobile/customer/reward/route";
import searchScreenCustomerRoutes from "../features/mobile/customer/search/route";
import homeScreenSubAdminRoutes from "../features/mobile/sub-admin/home/route";
import customerAuthRoutes from "../features/user/customer/route";
import subAdminAuthRoutes from "../features/user/sub-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";
import { getSettings } from "../features/mobile/common/controller";

const router = express.Router();

router.get("/app-version", getSettings);

router.use("/auth-screen/sub-admin", subAdminAuthRoutes);
router.use("/auth-screen/customer", customerAuthRoutes);

//#################### CUSTOMER #########################
router.use("/customer/home-screen", authAndPermissionCheck(ROLE.CUSTOMER), homeScreenCustomerRoutes);
router.use("/customer/search-screen", authAndPermissionCheck(ROLE.CUSTOMER), searchScreenCustomerRoutes);
router.use("/customer/reward-screen", authAndPermissionCheck(ROLE.CUSTOMER), rewardScreenCustomerRoutes);
router.use("/customer/notification-screen", authAndPermissionCheck(ROLE.CUSTOMER), notificationScreenCustomerRoutes);
router.use("/customer/profile-screen", profileScreenCustomerRoutes);

//#################### Loyalty Executive #########################
router.use("/sub-admin/home-screen", authAndPermissionCheck(ROLE.SUB_ADMIN), homeScreenSubAdminRoutes);

export default router;
