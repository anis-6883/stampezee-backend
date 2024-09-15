import express from "express";
import { getAllBillings, getRetailerBillingPortal, getSingleBilling } from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.post("/portal", getRetailerBillingPortal);
router.get("/find/:id", getSingleBilling);

export default router;
