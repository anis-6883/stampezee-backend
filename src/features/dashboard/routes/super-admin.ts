import express from "express";
import {
  customerStatsWithCountryWise,
  retailerStatsWithCountryWise,
  superAdminDashboardCardStats,
  superAdminDashboardRevenue,
} from "../controller";

const router = express.Router();

router.get("/calc", superAdminDashboardCardStats);
router.get("/revenue-stats", superAdminDashboardRevenue);
router.get("/country-wise-retailer-stats", retailerStatsWithCountryWise);
router.get("/country-wise-customer-stats", customerStatsWithCountryWise);

export default router;
