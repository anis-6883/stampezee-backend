import Joi from "joi";
import { emailField, requiredEmailField, requiredStringField, stringField, weakPasswordField } from "../../helpers";

const updateLongitude = Joi.when("address", {
  is: Joi.exist(),
  then: Joi.number().required().messages({
    "any.required": "longitude is required!",
    "number.base": "longitude must be number!",
  }),
  otherwise: Joi.number().messages({
    "number.base": "longitude must be number!",
  }),
});

const updateLatitude = Joi.when("address", {
  is: Joi.exist(),
  then: Joi.number().required().messages({
    "any.required": "latitude is required!",
    "number.base": "latitude must be number!",
  }),
  otherwise: Joi.number().messages({
    "number.base": "latitude must be number!",
  }),
});

export const customerRegisterSchema = Joi.object({
  email: requiredEmailField,
  password: weakPasswordField(6),
  fullName: requiredStringField("fullName"),
  phone: requiredStringField("phone"),
  country: requiredStringField("country"),
  dialCode: requiredStringField("dialCode"),
});

export const retailerRegisterSchema = Joi.object({
  email: requiredEmailField,
  password: weakPasswordField(8),
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
});

export const superAdminRegisterSchema = Joi.object({
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
  email: requiredEmailField,
  password: weakPasswordField(6),
});

export const superAdminRegisterSchema2 = Joi.object({
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
  email: emailField,
});

export const loginSchema = Joi.object({
  email: requiredEmailField,
  password: requiredStringField("password"),
});

export const verifyOtpSchema = Joi.object({
  otp: Joi.number().required().integer().min(100000).max(999999).messages({
    "number.base": "otp must be number!",
    "number.integer": "otp must be integer!",
    "number.min": "otp must be 6 digits long!",
    "number.max": "otp must be 6 digits long!",
    "any.required": "otp is required!",
  }),
});

export const locationTokenSchema = Joi.object({
  address: stringField("address"),
  deviceToken: stringField("deviceToken"),
  longitude: updateLongitude,
  latitude: updateLatitude,
});
