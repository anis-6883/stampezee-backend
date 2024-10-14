import Joi from "joi";
import { requiredStringField } from "../../helpers";

export const criticalPaymentSchema = Joi.object({
  stripeInvoiceId: requiredStringField("stripeInvoiceId"),
});
