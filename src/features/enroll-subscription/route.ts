import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import { enrollSubscription, getAllPlans } from "./controller";

const router = express.Router();

router.get("/", getAllPlans);
router.post("/checkout", authAndPermissionCheck(ROLE.RETAILER), enrollSubscription);

export default router;
