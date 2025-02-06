import Joi from "joi";
import {
  numberField,
  requiredBooleanField,
  requiredEmailField,
  requiredStringField,
  requiredWeakPasswordField,
  stringField,
} from "../../helpers";

// Main schemas
export const retailerSchema = Joi.object({
  email: requiredEmailField,
  password: requiredWeakPasswordField(8),
  storeName: requiredStringField("storeName"),
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
  dialCode: requiredStringField("dialCode"),
  phone: requiredStringField("phone"),
  country: requiredStringField("country"),
  province: requiredStringField("province"),
  city: requiredStringField("city"),
  postalCode: requiredStringField("postalCode"),
  address: requiredStringField("address"),
  status: Joi.boolean().default(true),
  about: stringField("about"),
  website: stringField("website"),
  businessCurrency: stringField("businessCurrency"),
  longitude: requiredStringField("longitude"),
  latitude: requiredStringField("latitude"),
  timezone: Joi.object({
    label: stringField("label"),
    value: numberField("value"),
  }),
});

// Without Password
export const retailerSchemaUpdate = Joi.object({
  // email: emailField,
  storeName: stringField("storeName"),
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
  dialCode: stringField("dialCode"),
  phone: stringField("phone"),
  country: stringField("country"),
  province: stringField("province"),
  city: stringField("city"),
  postalCode: stringField("postalCode"),
  address: stringField("address"),
  status: Joi.boolean().default(true),
  about: stringField("about"),
  website: stringField("website"),
  businessCurrency: stringField("businessCurrency"),
  longitude: stringField("longitude"),
  latitude: stringField("latitude"),
  timezone: Joi.object({
    label: stringField("label"),
    value: numberField("value"),
  }),
});

export const retailerStatusSchema = Joi.object({
  status: requiredBooleanField("status"),
});
