import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import { couponValidityCheck, enrollSubscription, getAllPlans, priceUpdateTestInStripe } from "./controller";

const router = express.Router();

router.get("/", getAllPlans);

router.use(authAndPermissionCheck(ROLE.RETAILER));
router.post("/coupon-validity-check", couponValidityCheck);
router.post("/checkout", enrollSubscription);
router.get("/test-stripe", priceUpdateTestInStripe);

export default router;
