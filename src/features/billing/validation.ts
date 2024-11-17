import Joi from "joi";
import { requiredObjectIdField, requiredStringField } from "../../helpers";

export const portalSchema = Joi.object({
  customerId: requiredStringField("customerId"),
  returnUrl: requiredStringField("returnUrl"),
});

export const enrollSubscriptionSchema = Joi.object({
  enrollSubscriptionId: requiredObjectIdField("enrollSubscriptionId"),
});
