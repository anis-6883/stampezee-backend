import express from "express";
import { ROLE } from "../../../../configs/constants";
import { authAndPermissionCheck } from "../../../../middlewares/authMiddleware";
import { customerCollectedRewardHistory, customerScanHistory, getSettings } from "./controller";

const router = express.Router();

router.get("/settings", getSettings);
router.get("/transaction/scan-history", authAndPermissionCheck(ROLE.CUSTOMER), customerScanHistory);
router.get("/transaction/reward-history", authAndPermissionCheck(ROLE.CUSTOMER), customerCollectedRewardHistory);

export default router;
