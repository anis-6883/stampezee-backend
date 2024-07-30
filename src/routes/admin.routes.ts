import express from "express";
import { ROLE } from "../configs/constants";
import categoryRoutes from "../features/category/route";
import contactRoutes from "../features/contact/route";
import couponRoutes from "../features/coupon/route";
import manageCustomerRoutes from "../features/customer/routes/super-admin";
import dashboardRoutes from "../features/dashboard/routes/super-admin";
import faqRoutes from "../features/faq/route";
import newsletterRoutes from "../features/newsletter/route";
import notificationRoutes from "../features/notification/routes/super-admin";
import paymentRoutes from "../features/payment/route";
import refundRoutes from "../features/refund/routes/super-admin";
import manageRetailerRoutes from "../features/retailer/route";
import scansRoutes from "../features/scans/routes/super-admin";
import settingsRoutes from "../features/settings/route";
import sortingRoutes from "../features/sorting/route";
import stampImageRoutes from "../features/stamp-image/route";
import subscriptionRoutes from "../features/subscription/route";
import superAdminAuthRoutes from "../features/user/super-admin/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

router.use("/super-admin", superAdminAuthRoutes);

router.use(authAndPermissionCheck(ROLE.SUPER_ADMIN));
router.use("/super-admin/dashboard", dashboardRoutes);
router.use("/super-admin/scans", scansRoutes);
router.use("/super-admin/faq", faqRoutes);
router.use("/super-admin/newsletter", newsletterRoutes);
router.use("/super-admin/contact", contactRoutes);
router.use("/super-admin/sort", sortingRoutes);
router.use("/super-admin/coupon", couponRoutes);
router.use("/super-admin/payment", paymentRoutes);
router.use("/super-admin/refund", refundRoutes);
router.use("/super-admin/settings", settingsRoutes);
router.use("/super-admin/category", categoryRoutes);
router.use("/super-admin/stamp-image", stampImageRoutes);
router.use("/super-admin/subscription", subscriptionRoutes);
router.use("/super-admin/manage-retailer", manageRetailerRoutes);
router.use("/super-admin/manage-customer", manageCustomerRoutes);
router.use("/super-admin/notification", notificationRoutes);

export default router;
