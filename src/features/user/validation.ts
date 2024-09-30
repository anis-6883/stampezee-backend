import Joi from "joi";
import { requiredEmailField, requiredStringField, requiredWeakPasswordField, stringField } from "../../helpers";

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
  password: Joi.string().when("provider", {
    is: "email",
    then: requiredWeakPasswordField(6),
    otherwise: Joi.optional(),
  }),
  fullName: requiredStringField("fullName"),
  dialCode: stringField("dialCode"),
  phone: stringField("phone"),
  country: stringField("country"),
  provider: Joi.string().trim().required().lowercase().valid("email", "google", "apple").messages({
    "any.required": "provider is required!",
    "string.base": "provider must be string!",
    "any.only": "provider must be [email, google, apple]",
    "string.empty": "provider must not be empty!",
  }),
});

export const customerUpdateProfile = Joi.object({
  fullName: requiredStringField("fullName"),
  dialCode: requiredStringField("dialCode"),
  phone: requiredStringField("phone"),
  country: requiredStringField("country"),
});

export const retailerRegisterSchema = Joi.object({
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
});

export const superAdminRegisterSchema = Joi.object({
  firstName: requiredStringField("firstName"),
  lastName: stringField("lastName"),
  email: requiredEmailField,
  password: requiredWeakPasswordField(6),
});

export const superAdminRegisterSchema2 = Joi.object({
  firstName: stringField("firstName"),
  lastName: stringField("lastName"),
});

export const loginSchema = Joi.object({
  email: requiredEmailField,
  password: requiredStringField("password"),
});

export const customerLoginSchema = Joi.object({
  email: requiredEmailField,
  password: requiredWeakPasswordField(6),
});

export const verifyOtpSchema = Joi.object({
  otp: Joi.string().required().min(6).max(6).messages({
    "string.base": "otp must be number!",
    "any.required": "otp is required!",
    "string.min": "otp must be 6 digits long!",
    "string.max": "otp must be 6 digits long!",
  }),
});

export const locationTokenSchema = Joi.object({
  address: stringField("address"),
  deviceToken: stringField("deviceToken"),
  longitude: updateLongitude,
  latitude: updateLatitude,
});

export const forgetPasswordSchema = Joi.object({
  email: requiredEmailField,
});

export const retailerChangeForgetPasswordSchema = Joi.object({
  password: requiredWeakPasswordField(8),
  confirmPassword: Joi.any().equal(Joi.ref("password")).required().messages({
    "any.only": "passwords do not match!",
    "any.required": "confirmPassword is required!",
  }),
});

export const customerChangeForgetPasswordSchema = Joi.object({
  password: requiredWeakPasswordField(6),
  confirmPassword: Joi.any().equal(Joi.ref("password")).required().messages({
    "any.only": "passwords do not match!",
    "any.required": "confirmPassword is required!",
  }),
});

export const subAdminChangeForgetPasswordSchema = Joi.object({
  password: requiredWeakPasswordField(6),
  confirmPassword: Joi.any().equal(Joi.ref("password")).required().messages({
    "any.only": "passwords do not match!",
    "any.required": "confirmPassword is required!",
  }),
});

export const retailerChangePasswordSchema = Joi.object({
  oldPassword: requiredStringField("oldPassword"),
  newPassword: Joi.string().required().min(8).messages({
    "any.required": "newPassword is required!",
    "string.base": "newPassword must be string!",
    "string.min": "newPassword must be 8 characters long!",
  }),
  confirmPassword: Joi.any().equal(Joi.ref("newPassword")).required().messages({
    "any.only": "passwords do not match!",
    "any.required": "confirmPassword is required!",
  }),
});

export const superAdminChangePasswordSchema = Joi.object({
  oldPassword: requiredStringField("oldPassword"),
  newPassword: Joi.string().required().min(6).messages({
    "any.required": "newPassword is required!",
    "string.base": "newPassword must be string!",
    "string.min": "newPassword must be 8 characters long!",
  }),
  confirmPassword: Joi.any().equal(Joi.ref("newPassword")).required().messages({
    "any.only": "passwords do not match!",
    "any.required": "confirmPassword is required!",
  }),
});
