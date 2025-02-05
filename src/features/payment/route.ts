import express from "express";
import {
  attachPaymentMethod,
  cancelBasePlanOrAddOn,
  detachPaymentMethod,
  getAllPaymentMethod,
  getRetailerBillingPdf,
  setDefaultPaymentMethod,
  setupPaymentIntent,
} from "../billing/controller";
import { getRetailerBillingPortal, getSingleSubscriptionPayment, getSubscriptionPayments } from "./controller";

const router = express.Router();

router.get("/subscription/all", getSubscriptionPayments);
router.post("/retailer-billing-portal", getRetailerBillingPortal);
router.delete("/cancel-subscription", cancelBasePlanOrAddOn);
router.get("/subscription/find/:id", getSingleSubscriptionPayment);
router.post("/download-pdf/:id", getRetailerBillingPdf);

router.post("/attach-payment-method", attachPaymentMethod);
router.post("/detach-payment-method", detachPaymentMethod);
router.post("/default-payment-method", setDefaultPaymentMethod);
router.get("/payment-method/all/:customerId", getAllPaymentMethod);
router.post("/setup-payment-intent", setupPaymentIntent);

export default router;
