import Joi from "joi";
import {
  requiredBooleanField,
  requiredEmailField,
  requiredStringField,
  requiredWeakPasswordField,
  stringField,
} from "../../helpers";

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
  status: requiredBooleanField("status"),
});
