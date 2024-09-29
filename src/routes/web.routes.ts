import express from "express";
import { ROLE } from "../configs/constants";
import billingRoutes from "../features/billing/route";
import branchRoutes from "../features/branch/route";
import { submitContact } from "../features/contact/controller";
import { getAllCurrencyExchanges, getTwoCurrencyExchangeRate } from "../features/currency-exchange/controller";
import customerRoutes from "../features/customer/routes/retailer";
import dashboardRoutes from "../features/dashboard/routes/retailer";
import subscriptionRoutes from "../features/enroll-subscription/route";
import { getAllFaqsForWeb } from "../features/faq/controller";
import { subscribeNewsletter } from "../features/newsletter/controller";
import notificationRoutes from "../features/notification/routes/retailer";
import refundRoutes from "../features/refund/routes/retailer";
import scansRoutes from "../features/scans/routes/retailer";
import { getCommonSettings, getSecretSettings } from "../features/settings/controller";
import stampImageRoutes from "../features/stamp-image/route";
import stampRoutes from "../features/stamp/route";
import subAdminRoutes from "../features/sub-admin/route";
import { refreshAccessToken } from "../features/user/controller";
import retailerAuthRoutes from "../features/user/retailer/route";
import { authAndPermissionCheck } from "../middlewares/authMiddleware";

const router = express.Router();

// Common Routes
router.get("/faqs", getAllFaqsForWeb);
router.post("/newsletter/join", subscribeNewsletter);
router.post("/contact/submit", submitContact);
router.get("/get-common-settings", getCommonSettings);
router.get("/get-secret-settings", authAndPermissionCheck("", false, false), getSecretSettings);
router.get("/refresh-token", authAndPermissionCheck("", false), refreshAccessToken);
router.get("/currency-exchange/list", getAllCurrencyExchanges);
router.get("/currency-exchange/rates", getTwoCurrencyExchangeRate);

// Subscription Routes
router.use("/subscription-plans", subscriptionRoutes);

// Retailer Auth Routes
router.use("/retailer", retailerAuthRoutes);

// Retailer Panel Feature Routes
router.use(authAndPermissionCheck(ROLE.RETAILER));
router.use("/retailer/dashboard", dashboardRoutes);
router.use("/retailer/stamp", stampRoutes);
router.use("/retailer/scans", scansRoutes);
router.use("/retailer/branch", branchRoutes);
router.use("/retailer/sub-admin", subAdminRoutes);
router.use("/retailer/stamp-image", stampImageRoutes);
router.use("/retailer/billing", billingRoutes);
router.use("/retailer/notification", notificationRoutes);
router.use("/retailer/refund", refundRoutes);
router.use("/retailer/manage-customer", customerRoutes);

export default router;
