import express from "express";
import { avgCollectedStamp, retailerDashboardCardStats, rewardCollectPercentage } from "../controller";

const router = express.Router();

router.get("/calc", retailerDashboardCardStats);
router.get("/avg-collected-stamp", avgCollectedStamp);
router.get("/reward-collect-percentage", rewardCollectPercentage);

export default router;
