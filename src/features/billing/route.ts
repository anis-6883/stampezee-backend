import express from "express";
import { getAllBillings, getRetailerBillingPdf, getRetailerBillingPortal, getSingleBilling } from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.post("/portal", getRetailerBillingPortal);
router.post("/download-pdf/:id", getRetailerBillingPdf);
router.get("/find/:id", getSingleBilling);

export default router;
