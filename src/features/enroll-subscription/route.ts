import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import {
  couponValidityCheck,
  deleteSubItem,
  enrollSubscriptionRebuild,
  getAllPlans,
  testMultiPackage,
} from "./controller";

const router = express.Router();

router.get("/", getAllPlans);
router.post("/coupon-validity-check", authAndPermissionCheck(ROLE.RETAILER), couponValidityCheck);
router.post("/checkout", authAndPermissionCheck(ROLE.RETAILER), enrollSubscriptionRebuild);
router.get("/buy-multi-packages", authAndPermissionCheck(ROLE.RETAILER), testMultiPackage);
router.get("/delete-sub-item", authAndPermissionCheck(ROLE.RETAILER), deleteSubItem);

export default router;
