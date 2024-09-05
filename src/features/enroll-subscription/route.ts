import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import { couponValidityCheck, customerBillingPortal, enrollSubscription, getAllPlans } from "./controller";

const router = express.Router();

router.get("/", getAllPlans);
router.post("/coupon-validity-check", authAndPermissionCheck(ROLE.RETAILER), couponValidityCheck);
router.post("/checkout", authAndPermissionCheck(ROLE.RETAILER), enrollSubscription);
router.post("/customer-billing-portal/:customerId", authAndPermissionCheck(ROLE.RETAILER), customerBillingPortal);

export default router;
