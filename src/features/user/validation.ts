import Joi from "joi";

const firstName = Joi.string().trim().required().messages({
  "any.required": "firstName is required!",
  "string.base": "firstName must be string!",
  "string.empty": "firstName must not be empty!",
});

const lastName = Joi.string().trim().messages({
  "string.base": "lastName must be string!",
  "string.empty": "lastName must not be empty!",
});

const fullName = Joi.string().trim().required().messages({
  "any.required": "fullName is required!",
  "string.base": "fullName must be string!",
  "string.empty": "fullName must not be empty!",
});

const phone = Joi.string().trim().required().messages({
  "any.required": "phone is required!",
  "string.base": "phone must be string!",
});

const email = Joi.string().email().trim().required().messages({
  "any.required": "email is required!",
  "string.base": "email must be string!",
  "string.email": "email must be valid format!",
  "string.empty": "email must not be empty!",
});

const storeName = Joi.string().trim().required().messages({
  "any.required": "storeName is required!",
  "string.base": "storeName must be string!",
  "string.empty": "storeName must not be empty!",
});

const strongPassword = Joi.string()
  .required()
  .pattern(new RegExp("^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?!.*\\s).{6,}$"))
  .messages({
    "any.required": "password is required!",
    "string.base": "password must be string!",
    "string.pattern.base": "At least 6 characters long with 1 uppercase, 1 lowercase & 1 digit",
  });

const weakPassword = Joi.string().required().messages({
  "any.required": "password is required!",
  "string.base": "password must be string!",
  "string.empty": "password must not be empty!",
});

const password = Joi.string().required().messages({
  "any.required": "password is required!",
  "string.base": "password must be string!",
});

const country = Joi.string().trim().required().messages({
  "any.required": "country is required!",
  "string.base": "country must be string!",
});

const dialCode = Joi.string().trim().required().messages({
  "any.required": "dialCode is required!",
  "string.base": "dialCode must be string!",
});

const province = Joi.string().trim().required().messages({
  "any.required": "province is required!",
  "string.base": "province must be string!",
});

const city = Joi.string().trim().required().messages({
  "any.required": "city is required!",
  "string.base": "city must be string!",
});

const postalCode = Joi.string().trim().required().messages({
  "any.required": "postalCode is required!",
  "string.base": "postalCode must be string!",
});

const address = Joi.string().trim().required().messages({
  "any.required": "address is required!",
  "string.base": "address must be string!",
  "string.empty": "address must not be empty!",
});

const updateAddress = Joi.string().trim().messages({
  "string.base": "address must be string!",
  "string.empty": "address must not be empty!",
});

const deviceToken = Joi.string().trim().messages({
  "string.base": "deviceToken must be string!",
  "string.empty": "deviceToken must not be empty!",
});

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

const otp = Joi.number().required().integer().min(100000).max(999999).messages({
  "number.base": "otp must be number!",
  "number.integer": "otp must be integer!",
  "number.min": "otp must be 6 digits long!",
  "number.max": "otp must be 6 digits long!",
  "any.required": "otp is required!",
});

export const customerRegisterSchema = Joi.object({
  fullName,
  email,
  phone,
  country,
  dialCode,
  password: weakPassword,
});

export const retailerRegisterSchema = Joi.object({
  storeName,
  firstName,
  lastName,
  email,
  dialCode,
  phone,
  country,
  password: strongPassword,
  province,
  city,
  postalCode,
  address,
});

export const superAdminRegisterSchema = Joi.object({
  firstName,
  lastName,
  email,
  password,
});

export const loginSchema = Joi.object({
  email,
  password,
});

export const verifyOtpSchema = Joi.object({
  otp,
});

export const locationTokenSchema = Joi.object({
  address: updateAddress,
  longitude: updateLongitude,
  latitude: updateLatitude,
  deviceToken,
});
