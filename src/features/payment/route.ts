import express from "express";
import { getRetailerBillingPdf } from "../billing/controller";
import { getRetailerBillingPortal, getSingleSubscriptionPayment, getSubscriptionPayments } from "./controller";

const router = express.Router();

router.get("/subscription/all", getSubscriptionPayments);
router.post("/retailer-billing-portal", getRetailerBillingPortal);
router.get("/subscription/find/:id", getSingleSubscriptionPayment);
router.post("/download-pdf/:id", getRetailerBillingPdf);

export default router;
