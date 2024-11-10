import express from "express";
import { avgCollectedStamp, retailerDashboardCardStats } from "../controller";

const router = express.Router();

router.get("/calc", retailerDashboardCardStats);
router.get("/avg-collected-stamp", avgCollectedStamp);

export default router;
