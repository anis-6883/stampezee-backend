import Joi from "joi";
import { requiredStringField } from "../../helpers";

export const portalSchema = Joi.object({
  customerId: requiredStringField("customerId"),
  returnUrl: requiredStringField("returnUrl"),
});
