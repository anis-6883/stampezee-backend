import express from "express";
import {
  attachPaymentMethod,
  cancelBasePlanOrAddOn,
  changePaymentMethod,
  detachPaymentMethod,
  findPaymentMethod,
  getAllBillings,
  getAllExistingAddons,
  getAllPaymentMethod,
  getRetailerBillingPdf,
  getRetailerBillingPdfForFreeTrial,
  getRetailerBillingPortal,
  getSingleBilling,
  setDefaultPaymentMethod,
  setupPaymentIntent,
} from "./controller";

const router = express.Router();

router.get("/all", getAllBillings);
router.get("/all-existing-addons", getAllExistingAddons);
router.get("/find/:id", getSingleBilling);
router.post("/portal", getRetailerBillingPortal);
router.delete("/cancel-subscription", cancelBasePlanOrAddOn);
router.get("/payment-method/all/:customerId", getAllPaymentMethod);
router.get("/find-payment-method/:paymentMethodId", findPaymentMethod);
router.put("/change-payment-method", changePaymentMethod);

router.post("/attach-payment-method", attachPaymentMethod);
router.post("/detach-payment-method", detachPaymentMethod);
router.post("/default-payment-method", setDefaultPaymentMethod);

router.post("/setup-payment-intent", setupPaymentIntent);
router.post("/download-pdf/:id", getRetailerBillingPdf);
router.post("/download-pdf-trial/:id", getRetailerBillingPdfForFreeTrial);

export default router;
