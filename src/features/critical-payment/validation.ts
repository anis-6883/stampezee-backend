import Joi from "joi";
import { requiredStringField } from "../../helpers";

export const criticalPaymentSchema = Joi.object({
  stripeInvoiceId: requiredStringField("stripeInvoiceId"),
});
export const criticalPaymentTestDataSchema = Joi.object({
  paymentId: requiredStringField("paymentId"),
  enrollmentId: requiredStringField("enrollmentId"),
  stripeInvoiceId: requiredStringField("stripeInvoiceId"),
});
