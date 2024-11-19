import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import { couponValidityCheck, enrollSubscription, extraAddonCheck, getAllPlans } from "./controller";

const router = express.Router();

router.get("/", getAllPlans);

router.use(authAndPermissionCheck(ROLE.RETAILER));
router.post("/coupon-validity-check", couponValidityCheck);
router.post("/extra-addon-check", extraAddonCheck);
router.post("/checkout", enrollSubscription);

export default router;
