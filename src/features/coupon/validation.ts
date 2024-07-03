import Joi from "joi";
import { lowercaseStringField, requiredLowercaseStringField, stringField } from "../../helpers";

export const couponSchema = Joi.object({
  name: requiredLowercaseStringField("name"),
  description: stringField("description"),
});

export const updateCouponSchema = Joi.object({
  name: lowercaseStringField("name"),
  description: stringField("description"),
});

export const couponStatusSchema = Joi.object({
  status: Joi.boolean().required().messages({
    "any.required": "status is required!",
    "boolean.base": "status must be boolean!",
    "boolean.empty": "status must not be empty!",
  }),
});
