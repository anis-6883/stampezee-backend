import Joi from "joi";
import { requiredEmailField, requiredStringField, requiredWeakPasswordField, stringField } from "../../helpers";

export const customerSchema = Joi.object({
  email: requiredEmailField,
  password: requiredWeakPasswordField(6),
  fullName: requiredStringField("fullName"),
  dialCode: requiredStringField("dialCode"),
  phone: requiredStringField("phone"),
  country: requiredStringField("country"),
});

export const updateCustomerSchema = Joi.object({
  email: stringField("email"),
  fullName: stringField("fullName"),
  dialCode: stringField("dialCode"),
  phone: stringField("phone"),
  country: stringField("country"),
});

export const customerStatusSchema = Joi.object({
  status: Joi.boolean().required().messages({
    "any.required": "status is required!",
    "boolean.base": "status must be boolean!",
    "boolean.empty": "status must not be empty!",
  }),
});
