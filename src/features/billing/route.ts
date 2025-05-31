import express from "express";
import {
  attachPaymentMethod,
  cancelBasePlanOrAddOn,
  changePaymentMethod,
  detachPaymentMethod,
  findPaymentMethod,
  getAllEnrollments,
  getAllExistingAddons,
  getAllPaymentMethod,
  getRetailerBillingPdf,
  getRetailerBillingPdfForFreeTrial,
  getSingleEnrollment,
  getSingleEnrollmentPayments,
  setDefaultPaymentMethod,
  setupPaymentIntent,
} from "./controller";

const router = express.Router();

router.get("/all", getAllEnrollments);
router.get("/all-existing-addons", getAllExistingAddons);
router.get("/find/:id", getSingleEnrollment);
router.get("/find/payments/:enrollmentId", getSingleEnrollmentPayments);
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
