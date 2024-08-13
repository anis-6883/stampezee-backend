import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import {
  couponValidityCheck,
  customerBillingPortal,
  enrollSubscription,
  getAllPlans,
  testEnrollSubscription,
} from "./controller";

const router = express.Router();

router.get("/", getAllPlans);
router.post("/coupon-validity-check", authAndPermissionCheck(ROLE.RETAILER), couponValidityCheck);
router.post("/checkout", authAndPermissionCheck(ROLE.RETAILER), enrollSubscription);
router.post("/test-checkout", authAndPermissionCheck(ROLE.RETAILER), testEnrollSubscription);
router.post("/customer-billing-portal/:customerId", authAndPermissionCheck(ROLE.RETAILER), customerBillingPortal);

export default router;
