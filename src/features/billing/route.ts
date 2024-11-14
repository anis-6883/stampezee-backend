import express from "express";
import {
  attachPaymentMethod,
  getAllBillings,
  getAllPaymentMethod,
  getRetailerBillingPdf,
  getRetailerBillingPortal,
  getSingleBilling,
  setupPaymentIntent,
} from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.post("/portal", getRetailerBillingPortal);
router.post("/attach-payment-method", attachPaymentMethod);
router.get("/payment-method/all/:customerId", getAllPaymentMethod);
router.post("/setup-payment-intent", setupPaymentIntent);
router.post("/download-pdf/:id", getRetailerBillingPdf);
router.get("/find/:id", getSingleBilling);

export default router;
