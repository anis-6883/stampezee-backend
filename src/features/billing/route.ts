import express from "express";
import {
  attachPaymentMethod,
  getAllBillings,
  getRetailerBillingPdf,
  getRetailerBillingPortal,
  getSingleBilling,
  setupPaymentIntent,
} from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.post("/portal", getRetailerBillingPortal);
router.post("/attach-payment-method", attachPaymentMethod);
router.post("/setup-payment-intent", setupPaymentIntent);
router.post("/download-pdf/:id", getRetailerBillingPdf);
router.get("/find/:id", getSingleBilling);

export default router;
