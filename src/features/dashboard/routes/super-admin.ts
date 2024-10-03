import express from "express";
import { CustomerStatsWithCountryWise, fetchDashboardSuperAdmin, retailerStatsWithCountryWise } from "../controller";

const router = express.Router();

router.get("/calc", fetchDashboardSuperAdmin);
router.get("/country-wise-retailer-stats", retailerStatsWithCountryWise);
router.get("/country-wise-customer-stats", CustomerStatsWithCountryWise);

export default router;
