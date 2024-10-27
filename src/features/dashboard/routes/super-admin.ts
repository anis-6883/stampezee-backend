import express from "express";
import {
  customerStatsWithCountryWise,
  retailerStatsWithCountryWise,
  superAdminDashboardCardStats,
  superAdminDashboardRevenue,
  topOutlets,
} from "../controller";

const router = express.Router();

router.get("/calc", superAdminDashboardCardStats);
router.get("/top-outlets", topOutlets);
router.get("/revenue-stats", superAdminDashboardRevenue);
router.get("/country-wise-retailer-stats", retailerStatsWithCountryWise);
router.get("/country-wise-customer-stats", customerStatsWithCountryWise);

export default router;
