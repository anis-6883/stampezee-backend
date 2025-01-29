import express from "express";
import {
  attachPaymentMethod,
  cancelAddOnSubscription,
  detachPaymentMethod,
  getAllBillings,
  getAllPaymentMethod,
  getRetailerBillingPdf,
  getRetailerBillingPortal,
  getSingleBilling,
  setDefaultPaymentMethod,
  setupPaymentIntent,
} from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.get("/find/:id", getSingleBilling);
router.post("/portal", getRetailerBillingPortal);
router.delete("/cancel-addon-subscription", cancelAddOnSubscription);
router.post("/attach-payment-method", attachPaymentMethod);
router.post("/detach-payment-method", detachPaymentMethod);
router.post("/default-payment-method", setDefaultPaymentMethod);
router.get("/payment-method/all/:customerId", getAllPaymentMethod);
router.post("/setup-payment-intent", setupPaymentIntent);
router.post("/download-pdf/:id", getRetailerBillingPdf);

export default router;
