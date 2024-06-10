import express from "express";
import { ROLE } from "../../configs/constants";
import { authAndPermissionCheck } from "../../middlewares/authMiddleware";
import { enrollSubscription, getAllSubscriptions } from "./controller";

const router = express.Router();

router.get("/", getAllSubscriptions);
router.post("/checkout", authAndPermissionCheck(ROLE.RETAILER), enrollSubscription);

export default router;
