import express from "express";
import { retailerDashboardCardStats } from "../controller";

const router = express.Router();

router.get("/calc", retailerDashboardCardStats);

export default router;
