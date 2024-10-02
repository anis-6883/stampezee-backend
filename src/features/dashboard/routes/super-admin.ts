import express from "express";
import { fetchDashboardSuperAdmin, retailerStatsWithCountryWise } from "../controller";

const router = express.Router();

router.get("/calc", fetchDashboardSuperAdmin);
router.get("/country-wise-retailer-stats", retailerStatsWithCountryWise);

export default router;
